#include <linux/bpf.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_helpers.h>

#define OPENCLAW_EXECUTABLE_MAX 256

/* The target kernel BTF relocates this partial declaration by field name. */
struct linux_binprm {
  const char *filename;
};

struct openclaw_process_exec_event {
  __u64 timestamp_ns;
  __u32 pid;
  __u32 uid;
  char comm[16];
  char executable[OPENCLAW_EXECUTABLE_MAX];
};

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 20);
} events SEC(".maps");

SEC("raw_tracepoint/sched_process_exec")
int record_process_exec(void *ctx) {
  struct bpf_raw_tracepoint_args *raw_args = ctx;
  struct openclaw_process_exec_event *event;
  struct linux_binprm *bprm;
  const char *filename;
  __u64 pid_tgid;
  __u64 uid_gid;
  long filename_length;

  event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
  if (!event) return 0;

  bprm = (struct linux_binprm *)(unsigned long)raw_args->args[2];
  filename = BPF_CORE_READ(bprm, filename);
  if (!filename) {
    bpf_ringbuf_discard(event, 0);
    return 0;
  }
  filename_length = bpf_probe_read_kernel_str(
    event->executable,
    sizeof(event->executable),
    filename);
  if (filename_length <= 0 || filename_length >= sizeof(event->executable)) {
    bpf_ringbuf_discard(event, 0);
    return 0;
  }

  pid_tgid = bpf_get_current_pid_tgid();
  uid_gid = bpf_get_current_uid_gid();
  event->timestamp_ns = bpf_ktime_get_ns();
  event->pid = (__u32)(pid_tgid >> 32);
  event->uid = (__u32)uid_gid;
  bpf_get_current_comm(event->comm, sizeof(event->comm));
  bpf_ringbuf_submit(event, 0);
  return 0;
}

char LICENSE[] SEC("license") = "GPL";
