#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>

struct openclaw_process_exec_event {
  __u64 timestamp_ns;
  __u32 pid;
  __u32 uid;
  char comm[16];
};

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 20);
} events SEC(".maps");

SEC("tracepoint/sched/sched_process_exec")
int record_process_exec(void *ctx) {
  struct openclaw_process_exec_event *event;
  __u64 pid_tgid;
  __u64 uid_gid;

  (void)ctx;
  event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
  if (!event) return 0;

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
