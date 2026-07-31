#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct openclaw_network_connect_event {
  __u64 timestamp_ns;
  __u32 pid;
  __u32 uid;
  char comm[16];
  __u16 family;
  __u16 address_length;
};

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 20);
} events SEC(".maps");

SEC("fentry/__sys_connect")
int BPF_PROG(record_network_connect, int fd, const void *user_address, int address_length) {
  struct openclaw_network_connect_event *event;
  __u64 pid_tgid;
  __u64 uid_gid;
  __u64 bounded_address_length;
  __u16 family;

  (void)fd;
  event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
  if (!event) return 0;

  pid_tgid = bpf_get_current_pid_tgid();
  uid_gid = bpf_get_current_uid_gid();
  event->timestamp_ns = bpf_ktime_get_ns();
  event->pid = (__u32)(pid_tgid >> 32);
  event->uid = (__u32)uid_gid;
  bpf_get_current_comm(event->comm, sizeof(event->comm));

  family = 0;
  if (user_address && address_length >= (int)sizeof(family)
      && bpf_probe_read_user(&family, sizeof(family), user_address) == 0) {
    event->family = family;
  } else {
    event->family = 0;
  }
  bounded_address_length = address_length < 0 ? 0 : (__u64)address_length;
  event->address_length = bounded_address_length > 65535 ? 65535 : (__u16)bounded_address_length;
  bpf_ringbuf_submit(event, 0);
  return 0;
}

char LICENSE[] SEC("license") = "GPL";
