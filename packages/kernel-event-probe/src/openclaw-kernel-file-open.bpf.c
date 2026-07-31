#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct openclaw_file_open_how {
  __u64 flags;
  __u64 mode;
  __u64 resolve;
};

struct openclaw_file_open_event {
  __u64 timestamp_ns;
  __u32 pid;
  __u32 uid;
  char comm[16];
  __u64 flags;
  __u64 mode;
};

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 20);
} events SEC(".maps");

SEC("fentry/do_sys_openat2")
int BPF_PROG(record_file_open, int dfd, const void *filename, const struct openclaw_file_open_how *how) {
  struct openclaw_file_open_event *event;
  __u64 pid_tgid;
  __u64 uid_gid;
  __u64 flags = 0;
  __u64 mode = 0;

  (void)dfd;
  (void)filename;
  if (!how) return 0;
  if (bpf_probe_read_kernel(&flags, sizeof(flags), &how->flags) != 0) return 0;
  if (bpf_probe_read_kernel(&mode, sizeof(mode), &how->mode) != 0) return 0;

  event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
  if (!event) return 0;
  pid_tgid = bpf_get_current_pid_tgid();
  uid_gid = bpf_get_current_uid_gid();
  event->timestamp_ns = bpf_ktime_get_ns();
  event->pid = (__u32)(pid_tgid >> 32);
  event->uid = (__u32)uid_gid;
  event->flags = flags;
  event->mode = mode;
  bpf_get_current_comm(event->comm, sizeof(event->comm));
  bpf_ringbuf_submit(event, 0);
  return 0;
}

char LICENSE[] SEC("license") = "GPL";
