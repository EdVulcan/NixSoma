#define _GNU_SOURCE

#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <unistd.h>

#include <libweston/libweston.h>
#include <weston.h>

#ifndef NIXSOMA_CAPTURE_HELPER
#error "NIXSOMA_CAPTURE_HELPER must name the fixed capture client"
#endif

#define CAPTURE_DIRECTORY "capture"
#define CAPTURE_REQUEST "request"

struct frame_authority {
	struct weston_compositor *compositor;
	struct wl_client *client;
	struct wl_listener client_destroy_listener;
	struct wl_listener compositor_destroy_listener;
	struct wl_listener authorization_listener;
	struct wl_event_source *inotify_source;
	int inotify_fd;
	int watch_fd;
	char request_path[PATH_MAX];
};

static void
capture_client_destroyed(struct wl_listener *listener, void *data)
{
	struct frame_authority *authority =
		wl_container_of(listener, authority, client_destroy_listener);

	(void)data;
	wl_list_remove(&authority->client_destroy_listener.link);
	wl_list_init(&authority->client_destroy_listener.link);
	authority->client = NULL;
}

static void
authorize_capture(struct wl_listener *listener,
		  struct weston_output_capture_attempt *attempt)
{
	struct frame_authority *authority =
		wl_container_of(listener, authority, authorization_listener);

	if (authority->client && attempt->who->client == authority->client)
		attempt->authorized = true;
}

static void
start_capture(struct frame_authority *authority)
{
	if (authority->client)
		return;

	authority->client = wet_client_start(authority->compositor,
					    NIXSOMA_CAPTURE_HELPER);
	if (!authority->client) {
		weston_log("NixSoma frame authority could not start capture client.\n");
		return;
	}

	authority->client_destroy_listener.notify = capture_client_destroyed;
	wl_client_add_destroy_listener(authority->client,
				       &authority->client_destroy_listener);
}

static int
capture_request_ready(int fd, uint32_t mask, void *data)
{
	struct frame_authority *authority = data;
	char buffer[4096] __attribute__((aligned(__alignof__(struct inotify_event))));
	ssize_t length;

	(void)mask;
	while ((length = read(fd, buffer, sizeof(buffer))) > 0) {
		const char *cursor = buffer;
		const char *end = buffer + length;

		while (cursor < end) {
			const struct inotify_event *event =
				(const struct inotify_event *)cursor;

			if (event->len > 0 &&
			    strcmp(event->name, CAPTURE_REQUEST) == 0 &&
			    (event->mask & (IN_CLOSE_WRITE | IN_MOVED_TO))) {
				if (unlink(authority->request_path) < 0 && errno != ENOENT)
					weston_log("NixSoma frame authority could not remove request: %s\n",
						   strerror(errno));
				start_capture(authority);
			}

			cursor += sizeof(*event) + event->len;
		}
	}

	if (length < 0 && errno != EAGAIN)
		weston_log("NixSoma frame authority inotify read failed: %s\n",
			   strerror(errno));
	return 0;
}

static void
frame_authority_destroyed(struct wl_listener *listener, void *data)
{
	struct frame_authority *authority =
		wl_container_of(listener, authority, compositor_destroy_listener);

	(void)data;
	if (authority->client)
		wl_list_remove(&authority->client_destroy_listener.link);
	if (authority->inotify_source)
		wl_event_source_remove(authority->inotify_source);
	if (authority->watch_fd >= 0)
		inotify_rm_watch(authority->inotify_fd, authority->watch_fd);
	if (authority->inotify_fd >= 0)
		close(authority->inotify_fd);
	wl_list_remove(&authority->authorization_listener.link);
	wl_list_remove(&authority->compositor_destroy_listener.link);
	free(authority);
}

WL_EXPORT int
wet_module_init(struct weston_compositor *compositor, int *argc, char *argv[])
{
	struct frame_authority *authority;
	struct wl_event_loop *loop;
	const char *runtime_directory;
	char capture_directory[PATH_MAX];
	int written;

	(void)argc;
	(void)argv;
	runtime_directory = getenv("XDG_RUNTIME_DIR");
	if (!runtime_directory || runtime_directory[0] != '/')
		return -1;

	authority = calloc(1, sizeof(*authority));
	if (!authority)
		return -1;
	authority->compositor = compositor;
	authority->inotify_fd = -1;
	authority->watch_fd = -1;
	wl_list_init(&authority->client_destroy_listener.link);

	written = snprintf(capture_directory, sizeof(capture_directory), "%s/%s",
			   runtime_directory, CAPTURE_DIRECTORY);
	if (written < 0 || (size_t)written >= sizeof(capture_directory))
		goto fail;
	written = snprintf(authority->request_path, sizeof(authority->request_path),
			   "%s/%s", capture_directory, CAPTURE_REQUEST);
	if (written < 0 || (size_t)written >= sizeof(authority->request_path))
		goto fail;

	authority->inotify_fd = inotify_init1(IN_CLOEXEC | IN_NONBLOCK);
	if (authority->inotify_fd < 0)
		goto fail;
	authority->watch_fd = inotify_add_watch(authority->inotify_fd,
						capture_directory,
						IN_CLOSE_WRITE | IN_MOVED_TO);
	if (authority->watch_fd < 0)
		goto fail;

	loop = wl_display_get_event_loop(compositor->wl_display);
	authority->inotify_source = wl_event_loop_add_fd(loop,
							authority->inotify_fd,
							WL_EVENT_READABLE,
							capture_request_ready,
							authority);
	if (!authority->inotify_source)
		goto fail;

	authority->compositor_destroy_listener.notify = frame_authority_destroyed;
	wl_signal_add(&compositor->destroy_signal,
		      &authority->compositor_destroy_listener);
	weston_compositor_add_screenshot_authority(compositor,
						   &authority->authorization_listener,
						   authorize_capture);
	weston_log("NixSoma fixed output capture authority is ready.\n");
	return 0;

fail:
	weston_log("NixSoma frame authority initialization failed: %s\n",
		   strerror(errno));
	if (authority->watch_fd >= 0)
		inotify_rm_watch(authority->inotify_fd, authority->watch_fd);
	if (authority->inotify_fd >= 0)
		close(authority->inotify_fd);
	free(authority);
	return -1;
}
