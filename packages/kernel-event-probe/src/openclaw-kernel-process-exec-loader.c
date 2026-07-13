#include <bpf/libbpf.h>

#include <errno.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

struct openclaw_process_exec_event {
  uint64_t timestamp_ns;
  uint32_t pid;
  uint32_t uid;
  char comm[16];
  char executable[256];
};

struct capture_context {
  size_t event_count;
  size_t max_events;
  volatile sig_atomic_t stop;
};

static volatile sig_atomic_t interrupted = 0;

static void handle_signal(int signal_number) {
  (void)signal_number;
  interrupted = 1;
}

static uint64_t monotonic_milliseconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return 0;
  return ((uint64_t)now.tv_sec * 1000ULL) + ((uint64_t)now.tv_nsec / 1000000ULL);
}

static int parse_unsigned(const char *value, uint64_t *result) {
  char *end = NULL;
  unsigned long long parsed;

  errno = 0;
  parsed = strtoull(value, &end, 10);
  if (errno != 0 || end == value || *end != '\0') return -1;
  *result = (uint64_t)parsed;
  return 0;
}

static void print_json_string(const char *value) {
  const unsigned char *cursor = (const unsigned char *)value;
  putchar('"');
  for (; *cursor != '\0'; cursor += 1) {
    switch (*cursor) {
      case '"': fputs("\\\"", stdout); break;
      case '\\': fputs("\\\\", stdout); break;
      case '\n': fputs("\\n", stdout); break;
      case '\r': fputs("\\r", stdout); break;
      case '\t': fputs("\\t", stdout); break;
      default:
        if (*cursor < 0x20) printf("\\u%04x", *cursor);
        else putchar(*cursor);
        break;
    }
  }
  putchar('"');
}

static int handle_event(void *raw_context, void *raw_data, size_t data_size) {
  struct capture_context *context = raw_context;
  const struct openclaw_process_exec_event *event = raw_data;

  if (data_size < sizeof(*event)) return 0;
  printf("{\"timestampNs\":\"%llu\",\"pid\":%u,\"uid\":%u,\"comm\":",
    (unsigned long long)event->timestamp_ns,
    event->pid,
    event->uid);
  print_json_string(event->comm);
  fputs(",\"executable\":", stdout);
  print_json_string(event->executable);
  puts("}");
  context->event_count += 1;
  if (context->event_count >= context->max_events) context->stop = 1;
  return 0;
}

static void usage(const char *program) {
  fprintf(stderr, "usage: %s --object-path PATH [--duration-ms N] [--max-events N]\n", program);
}

int main(int argc, char **argv) {
  const char *object_path = NULL;
  uint64_t duration_ms = 1000;
  uint64_t max_events = 128;
  struct bpf_object *object = NULL;
  struct bpf_program *program = NULL;
  struct bpf_link *link = NULL;
  struct ring_buffer *ring = NULL;
  struct bpf_map *map = NULL;
  struct capture_context context = {0};
  uint64_t deadline;
  int result = EXIT_FAILURE;
  int index;

  for (index = 1; index < argc; index += 1) {
    if (strcmp(argv[index], "--object-path") == 0 && index + 1 < argc) {
      object_path = argv[++index];
    } else if (strcmp(argv[index], "--duration-ms") == 0 && index + 1 < argc) {
      if (parse_unsigned(argv[++index], &duration_ms) != 0) return EXIT_FAILURE;
    } else if (strcmp(argv[index], "--max-events") == 0 && index + 1 < argc) {
      if (parse_unsigned(argv[++index], &max_events) != 0) return EXIT_FAILURE;
    } else {
      usage(argv[0]);
      return EXIT_FAILURE;
    }
  }

  if (!object_path || duration_ms == 0 || duration_ms > 5000 || max_events == 0 || max_events > 4096) {
    usage(argv[0]);
    return EXIT_FAILURE;
  }

  signal(SIGINT, handle_signal);
  signal(SIGTERM, handle_signal);
  setvbuf(stdout, NULL, _IOLBF, 0);
  context.max_events = (size_t)max_events;
  object = bpf_object__open_file(object_path, NULL);
  if (libbpf_get_error(object)) {
    object = NULL;
    goto cleanup;
  }
  if (bpf_object__load(object) != 0) goto cleanup;
  program = bpf_object__find_program_by_name(object, "record_process_exec");
  if (!program) goto cleanup;
  link = bpf_program__attach(program);
  if (libbpf_get_error(link)) {
    link = NULL;
    goto cleanup;
  }
  map = bpf_object__find_map_by_name(object, "events");
  if (!map) goto cleanup;
  ring = ring_buffer__new(bpf_map__fd(map), handle_event, &context, NULL);
  if (!ring) goto cleanup;

  deadline = monotonic_milliseconds() + duration_ms;
  while (!interrupted && !context.stop && monotonic_milliseconds() < deadline) {
    int poll_result = ring_buffer__poll(ring, 50);
    if (poll_result < 0 && poll_result != -EINTR) goto cleanup;
  }
  result = EXIT_SUCCESS;

cleanup:
  ring_buffer__free(ring);
  bpf_link__destroy(link);
  bpf_object__close(object);
  return result;
}
