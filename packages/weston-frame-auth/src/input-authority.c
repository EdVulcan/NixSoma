#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/input-event-codes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>

#include <libweston/desktop.h>
#include <libweston/libweston.h>
#include <libweston/plugin-registry.h>

#include "input-authority.h"
#include "nixsoma-kiosk-shell-activation-api.h"

#ifndef NIXSOMA_INPUT_ENABLED
#define NIXSOMA_INPUT_ENABLED 0
#endif
#ifndef NIXSOMA_OUTPUT_WIDTH
#define NIXSOMA_OUTPUT_WIDTH 1280
#endif
#ifndef NIXSOMA_SURFACE_ACTIVATION_ENABLED
#define NIXSOMA_SURFACE_ACTIVATION_ENABLED 0
#endif
#ifndef NIXSOMA_OUTPUT_HEIGHT
#define NIXSOMA_OUTPUT_HEIGHT 720
#endif

#define INPUT_DIRECTORY "input"
#define INPUT_SOCKET "control.sock"
#define INPUT_MAX_BYTES 256
#define WORKBENCH_ACTION_DIRECTORY "workbench-action"
#define WORKBENCH_ACTION_FILE "acknowledged"
#ifndef SESSION_MANAGER_CGROUP_SUFFIX
#define SESSION_MANAGER_CGROUP_SUFFIX "/openclaw-session-manager.service"
#endif

void
notify_motion_absolute(struct weston_seat *seat, const struct timespec *time,
		       struct weston_coord_global pos);
void
notify_button(struct weston_seat *seat, const struct timespec *time,
	      int32_t button, enum wl_pointer_button_state state);
void
notify_axis(struct weston_seat *seat, const struct timespec *time,
	    struct weston_pointer_axis_event *event);
void
notify_axis_source(struct weston_seat *seat, uint32_t source);
void
notify_pointer_frame(struct weston_seat *seat);
void
notify_key(struct weston_seat *seat, const struct timespec *time, uint32_t key,
	   enum wl_keyboard_key_state state,
	   enum weston_key_state_update update_state);
void
weston_seat_init(struct weston_seat *seat, struct weston_compositor *compositor,
		 const char *seat_name);
int
weston_seat_init_pointer(struct weston_seat *seat);
int
weston_seat_init_keyboard(struct weston_seat *seat, struct xkb_keymap *keymap);
void
weston_seat_release(struct weston_seat *seat);

struct input_request {
	enum {
		INPUT_REQUEST_CLICK = 1,
		INPUT_REQUEST_ACTIVATE_SURFACE = 2,
		INPUT_REQUEST_SCROLL = 3,
		INPUT_REQUEST_SURFACE_CLICK = 4,
		INPUT_REQUEST_SURFACE_TYPE = 5,
	} operation;
	char id[33];
	char frame_sha256[65];
	uint32_t sequence;
	uint32_t x;
	uint32_t y;
	uint32_t inventory_sequence;
	uint32_t surface_id;
	int32_t direction;
	char text[33];
	uint32_t text_length;
};

struct nixsoma_input_authority {
	struct weston_compositor *compositor;
	const struct nixsoma_kiosk_shell_activation_api *surface_activation_api;
	struct wl_event_source *socket_source;
	int socket_fd;
	char socket_path[PATH_MAX];
	struct weston_seat seat;
	bool seat_initialized;
};

#if NIXSOMA_INPUT_ENABLED
static bool
write_all(int fd, const char *buffer, size_t length)
{
	while (length > 0) {
		ssize_t written = write(fd, buffer, length);
		if (written < 0) {
			if (errno == EINTR)
				continue;
			return false;
		}
		buffer += written;
		length -= (size_t)written;
	}
	return true;
}

static bool
peer_is_session_manager(int fd)
{
	struct ucred credentials;
	socklen_t credentials_length = sizeof(credentials);
	char cgroup_path[64];
	char cgroup[1024];
	char *match;
	ssize_t length;
	int cgroup_fd;
	int written;

	if (getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &credentials,
		       &credentials_length) < 0 || credentials.uid != getuid() ||
	    credentials.pid <= 1)
		return false;
	written = snprintf(cgroup_path, sizeof(cgroup_path), "/proc/%ld/cgroup",
			   (long)credentials.pid);
	if (written < 0 || (size_t)written >= sizeof(cgroup_path))
		return false;
	cgroup_fd = open(cgroup_path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
	if (cgroup_fd < 0)
		return false;
	length = read(cgroup_fd, cgroup, sizeof(cgroup) - 1);
	close(cgroup_fd);
	if (length <= 0)
		return false;
	cgroup[length] = '\0';
	match = strstr(cgroup, SESSION_MANAGER_CGROUP_SUFFIX);
	return match && (match[strlen(SESSION_MANAGER_CGROUP_SUFFIX)] == '\n' ||
			 match[strlen(SESSION_MANAGER_CGROUP_SUFFIX)] == '\0');
}

static bool
input_char_allowed(unsigned char value)
{
	return (value >= 'A' && value <= 'Z') ||
		(value >= 'a' && value <= 'z') ||
		(value >= '0' && value <= '9') ||
		value == ' ' || value == '.' || value == ',' ||
		value == '_' || value == '-';
}

static int
hex_nibble(char value)
{
	if (value >= '0' && value <= '9')
		return value - '0';
	if (value >= 'a' && value <= 'f')
		return value - 'a' + 10;
	return -1;
}

static bool
decode_input_text(const char *encoded, struct input_request *request)
{
	size_t encoded_length = strlen(encoded);
	size_t index;

	if (encoded_length < 2 || encoded_length > 64 || encoded_length % 2 != 0)
		return false;
	request->text_length = (uint32_t)(encoded_length / 2);
	for (index = 0; index < request->text_length; index++) {
		int high = hex_nibble(encoded[index * 2]);
		int low = hex_nibble(encoded[index * 2 + 1]);
		unsigned char value;

		if (high < 0 || low < 0)
			return false;
		value = (unsigned char)((high << 4) | low);
		if (!input_char_allowed(value))
			return false;
		request->text[index] = (char)value;
	}
	request->text[request->text_length] = '\0';
	return true;
}

static bool
read_request(int fd, struct input_request *request)
{
	char buffer[INPUT_MAX_BYTES + 1];
	char encoded_text[65];
	ssize_t length;
	size_t total = 0;
	int consumed = 0;

	while (total < INPUT_MAX_BYTES) {
		length = read(fd, buffer + total, INPUT_MAX_BYTES - total);
		if (length < 0 && errno == EINTR)
			continue;
		if (length <= 0)
			break;
		total += (size_t)length;
		if (buffer[total - 1] == '\n')
			break;
	}
	if (total == 0 || total > INPUT_MAX_BYTES)
		return false;
	buffer[total] = '\0';
	if (sscanf(buffer, "1 %32[0-9a-f] %64[0-9a-f] %u %u %u%n",
		   request->id, request->frame_sha256, &request->sequence,
		   &request->x, &request->y, &consumed) != 5 ||
	    strlen(request->id) != 32 || strlen(request->frame_sha256) != 64 ||
	    request->sequence == 0 || request->x >= NIXSOMA_OUTPUT_WIDTH ||
	    request->y >= NIXSOMA_OUTPUT_HEIGHT || consumed + 1 != (int)total ||
	    buffer[consumed] != '\n') {
		memset(request, 0, sizeof(*request));
		consumed = 0;
		if (sscanf(buffer, "2 %32[0-9a-f] %64[0-9a-f] %u %u %u%n",
			   request->id, request->frame_sha256, &request->sequence,
			   &request->inventory_sequence, &request->surface_id,
			   &consumed) != 5 || strlen(request->id) != 32 ||
		    strlen(request->frame_sha256) != 64 || request->sequence == 0 ||
		    request->inventory_sequence == 0 || request->surface_id == 0 ||
		    consumed + 1 != (int)total || buffer[consumed] != '\n') {
			memset(request, 0, sizeof(*request));
			consumed = 0;
			if (sscanf(buffer,
				   "3 %32[0-9a-f] %64[0-9a-f] %u %u %u %u %u %d%n",
				   request->id, request->frame_sha256,
				   &request->sequence, &request->inventory_sequence,
				   &request->surface_id, &request->x, &request->y,
				   &request->direction, &consumed) != 8 ||
			    strlen(request->id) != 32 ||
			    strlen(request->frame_sha256) != 64 ||
			    request->sequence == 0 ||
			    request->inventory_sequence == 0 ||
			    request->surface_id == 0 ||
			    request->x >= NIXSOMA_OUTPUT_WIDTH ||
			    request->y >= NIXSOMA_OUTPUT_HEIGHT ||
			    (request->direction != -1 && request->direction != 1) ||
				    consumed + 1 != (int)total || buffer[consumed] != '\n') {
				memset(request, 0, sizeof(*request));
				consumed = 0;
				if (sscanf(buffer,
					   "4 %32[0-9a-f] %64[0-9a-f] %u %u %u %u %u%n",
					   request->id, request->frame_sha256,
					   &request->sequence, &request->inventory_sequence,
					   &request->surface_id, &request->x, &request->y,
					   &consumed) != 7 || strlen(request->id) != 32 ||
				    strlen(request->frame_sha256) != 64 ||
				    request->sequence == 0 ||
				    request->inventory_sequence == 0 ||
				    request->surface_id == 0 ||
				    request->x >= NIXSOMA_OUTPUT_WIDTH ||
				    request->y >= NIXSOMA_OUTPUT_HEIGHT ||
				    consumed + 1 != (int)total || buffer[consumed] != '\n') {
					memset(request, 0, sizeof(*request));
					memset(encoded_text, 0, sizeof(encoded_text));
					consumed = 0;
					if (sscanf(buffer,
						   "5 %32[0-9a-f] %64[0-9a-f] %u %u %u %64[0-9a-f]%n",
						   request->id, request->frame_sha256,
						   &request->sequence,
						   &request->inventory_sequence,
						   &request->surface_id, encoded_text,
						   &consumed) != 6 || strlen(request->id) != 32 ||
					    strlen(request->frame_sha256) != 64 ||
					    request->sequence == 0 ||
					    request->inventory_sequence == 0 ||
					    request->surface_id == 0 ||
					    consumed + 1 != (int)total || buffer[consumed] != '\n' ||
					    !decode_input_text(encoded_text, request))
						return false;
					request->operation = INPUT_REQUEST_SURFACE_TYPE;
					return true;
				}
				request->operation = INPUT_REQUEST_SURFACE_CLICK;
				return true;
			}
			request->operation = INPUT_REQUEST_SCROLL;
			return true;
		}
		request->operation = INPUT_REQUEST_ACTIVATE_SURFACE;
		return true;
	}
	request->operation = INPUT_REQUEST_CLICK;
	return true;
}

static bool
execute_click(struct nixsoma_input_authority *authority,
	      const struct input_request *request)
{
	struct weston_coord_global position;
	struct weston_pointer *pointer;
	struct timespec time;

	pointer = weston_seat_get_pointer(&authority->seat);
	if (!pointer || clock_gettime(CLOCK_MONOTONIC, &time) < 0)
		return false;
	position.c = weston_coord((double)request->x + 0.5,
				  (double)request->y + 0.5);
	notify_motion_absolute(&authority->seat, &time, position);
	notify_button(&authority->seat, &time, BTN_LEFT, WL_POINTER_BUTTON_STATE_PRESSED);
	notify_button(&authority->seat, &time, BTN_LEFT, WL_POINTER_BUTTON_STATE_RELEASED);
	weston_pointer_send_frame(pointer);
	return true;
}

static bool
execute_surface_activation(struct nixsoma_input_authority *authority,
			   const struct input_request *request)
{
	return authority->surface_activation_api &&
		authority->surface_activation_api->activate_surface(
			authority->compositor, &authority->seat,
			request->surface_id);
}

static bool
execute_scroll(struct nixsoma_input_authority *authority,
	       const struct input_request *request)
{
	struct weston_pointer_axis_event event = {
		.axis = WL_POINTER_AXIS_VERTICAL_SCROLL,
		.value = (double)request->direction * 10.0,
		.has_discrete = true,
		.discrete = request->direction,
	};
	struct weston_coord_global position;
	struct timespec time;

	if (!weston_seat_get_pointer(&authority->seat) ||
	    clock_gettime(CLOCK_MONOTONIC, &time) < 0)
		return false;
	position.c = weston_coord((double)request->x + 0.5,
				  (double)request->y + 0.5);
	notify_motion_absolute(&authority->seat, &time, position);
	notify_axis_source(&authority->seat, WL_POINTER_AXIS_SOURCE_WHEEL);
	notify_axis(&authority->seat, &time, &event);
	notify_pointer_frame(&authority->seat);
	return true;
}

static bool
write_workbench_acknowledgement(void)
{
	const char *runtime_dir = getenv("XDG_RUNTIME_DIR");
	char path[PATH_MAX];
	struct stat status;
	int fd;
	int length;
	bool written;

	if (!runtime_dir || runtime_dir[0] != '/')
		return false;
	length = snprintf(path, sizeof(path), "%s/%s/%s", runtime_dir,
			  WORKBENCH_ACTION_DIRECTORY, WORKBENCH_ACTION_FILE);
	if (length < 0 || (size_t)length >= sizeof(path))
		return false;
	fd = open(path, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC | O_NOFOLLOW,
		  0600);
	if (fd < 0)
		return false;
	if (fstat(fd, &status) < 0 || !S_ISREG(status.st_mode) ||
	    status.st_uid != getuid() || (status.st_mode & 077) != 0) {
		close(fd);
		return false;
	}
	written = write_all(fd, "1\n", 2) && fsync(fd) == 0;
	if (close(fd) < 0)
		written = false;
	return written;
}

static bool
execute_surface_click(struct nixsoma_input_authority *authority,
		      const struct input_request *request)
{
	return execute_surface_activation(authority, request) &&
		execute_click(authority, request) &&
		write_workbench_acknowledgement();
}

static bool
key_for_input_char(unsigned char value, uint32_t *key, bool *shift)
{
	static const uint32_t letter_keys[26] = {
		KEY_A, KEY_B, KEY_C, KEY_D, KEY_E, KEY_F, KEY_G,
		KEY_H, KEY_I, KEY_J, KEY_K, KEY_L, KEY_M, KEY_N,
		KEY_O, KEY_P, KEY_Q, KEY_R, KEY_S, KEY_T, KEY_U,
		KEY_V, KEY_W, KEY_X, KEY_Y, KEY_Z,
	};
	static const uint32_t digit_keys[10] = {
		KEY_0, KEY_1, KEY_2, KEY_3, KEY_4,
		KEY_5, KEY_6, KEY_7, KEY_8, KEY_9,
	};

	*shift = false;
	if (value >= 'a' && value <= 'z') {
		*key = letter_keys[value - 'a'];
		return true;
	}
	if (value >= 'A' && value <= 'Z') {
		*key = letter_keys[value - 'A'];
		*shift = true;
		return true;
	}
	if (value >= '0' && value <= '9') {
		*key = digit_keys[value - '0'];
		return true;
	}
	switch (value) {
	case ' ':
		*key = KEY_SPACE;
		return true;
	case '.':
		*key = KEY_DOT;
		return true;
	case ',':
		*key = KEY_COMMA;
		return true;
	case '-':
		*key = KEY_MINUS;
		return true;
	case '_':
		*key = KEY_MINUS;
		*shift = true;
		return true;
	default:
		return false;
	}
}

static bool
execute_surface_type(struct nixsoma_input_authority *authority,
		     const struct input_request *request)
{
	struct weston_keyboard *keyboard;
	uint32_t index;

	if (!authority->surface_activation_api ||
	    !authority->surface_activation_api->activate_surface(
		authority->compositor, &authority->seat, request->surface_id))
		return false;
	keyboard = weston_seat_get_keyboard(&authority->seat);
	if (!keyboard)
		return false;
	for (index = 0; index < request->text_length; index++) {
		struct timespec time;
		uint32_t key;
		bool shift;

		if (!key_for_input_char((unsigned char)request->text[index], &key, &shift) ||
		    clock_gettime(CLOCK_MONOTONIC, &time) < 0)
			return false;
		if (shift)
			notify_key(&authority->seat, &time, KEY_LEFTSHIFT,
				   WL_KEYBOARD_KEY_STATE_PRESSED,
				   STATE_UPDATE_AUTOMATIC);
		notify_key(&authority->seat, &time, key,
			   WL_KEYBOARD_KEY_STATE_PRESSED, STATE_UPDATE_AUTOMATIC);
		notify_key(&authority->seat, &time, key,
			   WL_KEYBOARD_KEY_STATE_RELEASED, STATE_UPDATE_AUTOMATIC);
		if (shift)
			notify_key(&authority->seat, &time, KEY_LEFTSHIFT,
				   WL_KEYBOARD_KEY_STATE_RELEASED,
				   STATE_UPDATE_AUTOMATIC);
	}
	return true;
}

static bool
write_receipt(int fd, const struct input_request *request)
{
	char receipt[INPUT_MAX_BYTES + 1];
	int length;

	if (request->operation == INPUT_REQUEST_ACTIVATE_SURFACE) {
		length = snprintf(receipt, sizeof(receipt),
				  "2 %s %s %u %u %u executed\n",
				  request->id, request->frame_sha256,
				  request->sequence, request->inventory_sequence,
				  request->surface_id);
	} else if (request->operation == INPUT_REQUEST_SCROLL) {
		length = snprintf(receipt, sizeof(receipt),
				  "3 %s %s %u %u %u %u %u %d executed\n",
				  request->id, request->frame_sha256,
				  request->sequence, request->inventory_sequence,
				  request->surface_id, request->x, request->y,
				  request->direction);
	} else if (request->operation == INPUT_REQUEST_SURFACE_CLICK) {
		length = snprintf(receipt, sizeof(receipt),
				  "4 %s %s %u %u %u %u %u executed\n",
				  request->id, request->frame_sha256,
				  request->sequence, request->inventory_sequence,
				  request->surface_id, request->x, request->y);
	} else if (request->operation == INPUT_REQUEST_SURFACE_TYPE) {
		length = snprintf(receipt, sizeof(receipt),
				  "5 %s %s %u %u %u %u executed\n",
				  request->id, request->frame_sha256,
				  request->sequence, request->inventory_sequence,
				  request->surface_id, request->text_length);
	} else {
		length = snprintf(receipt, sizeof(receipt),
				  "1 %s %s %u %u %u executed\n",
				  request->id, request->frame_sha256,
				  request->sequence, request->x, request->y);
	}
	return length > 0 && (size_t)length < sizeof(receipt)
		&& write_all(fd, receipt, (size_t)length);
}

static void
handle_connection(struct nixsoma_input_authority *authority, int fd)
{
	struct timeval timeout = { .tv_sec = 0, .tv_usec = 200000 };
	struct input_request request = { 0 };
	bool executed;

	setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
	setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
	if (!peer_is_session_manager(fd)) {
		weston_log("NixSoma input authority rejected an unauthorized peer.\n");
		return;
	}
	if (!read_request(fd, &request)) {
		weston_log("NixSoma input authority rejected an invalid request.\n");
		return;
	}
	switch (request.operation) {
	case INPUT_REQUEST_CLICK:
		executed = execute_click(authority, &request);
		break;
	case INPUT_REQUEST_ACTIVATE_SURFACE:
		executed = execute_surface_activation(authority, &request);
		break;
	case INPUT_REQUEST_SCROLL:
		executed = execute_scroll(authority, &request);
		break;
	case INPUT_REQUEST_SURFACE_CLICK:
		executed = execute_surface_click(authority, &request);
		break;
	case INPUT_REQUEST_SURFACE_TYPE:
		executed = execute_surface_type(authority, &request);
		break;
	default:
		executed = false;
	}
	if (!executed || !write_receipt(fd, &request)) {
		weston_log("NixSoma input authority could not execute request %.32s.\n",
			   request.id);
		return;
	}
	weston_log("NixSoma input authority executed request %.32s.\n", request.id);
}

static int
input_connection_ready(int fd, uint32_t mask, void *data)
{
	struct nixsoma_input_authority *authority = data;
	int peer_fd;

	(void)mask;
	while ((peer_fd = accept4(fd, NULL, NULL, SOCK_CLOEXEC)) >= 0) {
		handle_connection(authority, peer_fd);
		close(peer_fd);
	}
	if (errno != EAGAIN && errno != EWOULDBLOCK)
		weston_log("NixSoma input authority accept failed: %s\n",
			   strerror(errno));
	return 0;
}
#endif

struct nixsoma_input_authority *
nixsoma_input_authority_create(struct weston_compositor *compositor)
{
#if NIXSOMA_INPUT_ENABLED
	struct nixsoma_input_authority *authority;
	struct wl_event_loop *loop;
	struct sockaddr_un address = { .sun_family = AF_UNIX };
	const char *runtime_directory = getenv("XDG_RUNTIME_DIR");
	int written;

	if (!runtime_directory || runtime_directory[0] != '/')
		return NULL;
	authority = calloc(1, sizeof(*authority));
	if (!authority)
		return NULL;
	authority->compositor = compositor;
	authority->socket_fd = -1;
#if NIXSOMA_SURFACE_ACTIVATION_ENABLED
	authority->surface_activation_api = weston_plugin_api_get(
		compositor, NIXSOMA_KIOSK_SHELL_ACTIVATION_API_NAME,
		sizeof(*authority->surface_activation_api));
	if (!authority->surface_activation_api)
		goto fail;
#endif
	written = snprintf(authority->socket_path, sizeof(authority->socket_path),
			   "%s/%s/%s", runtime_directory, INPUT_DIRECTORY,
			   INPUT_SOCKET);
	if (written < 0 || (size_t)written >= sizeof(authority->socket_path) ||
	    (size_t)written >= sizeof(address.sun_path))
		goto fail;
	memcpy(address.sun_path, authority->socket_path, (size_t)written + 1);
	unlink(authority->socket_path);
	authority->socket_fd = socket(AF_UNIX,
				      SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
	if (authority->socket_fd < 0 ||
	    bind(authority->socket_fd, (struct sockaddr *)&address, sizeof(address)) < 0 ||
	    chmod(authority->socket_path, 0600) < 0 || listen(authority->socket_fd, 1) < 0)
		goto fail;
	loop = wl_display_get_event_loop(compositor->wl_display);
	authority->socket_source = wl_event_loop_add_fd(loop, authority->socket_fd,
							WL_EVENT_READABLE,
							input_connection_ready,
							authority);
	if (!authority->socket_source)
		goto fail;
	weston_seat_init(&authority->seat, compositor, "nixsoma-fixed-pointer");
	authority->seat_initialized = true;
	if (weston_seat_init_pointer(&authority->seat) < 0)
		goto fail;
	if (weston_seat_init_keyboard(&authority->seat, NULL) < 0)
		goto fail;
	weston_log("NixSoma fixed-output input authority is ready.\n");
	return authority;

fail:
	nixsoma_input_authority_destroy(authority);
	return NULL;
#else
	(void)compositor;
	return (struct nixsoma_input_authority *)(uintptr_t)1;
#endif
}

void
nixsoma_input_authority_destroy(struct nixsoma_input_authority *authority)
{
#if NIXSOMA_INPUT_ENABLED
	if (!authority)
		return;
	if (authority->socket_source)
		wl_event_source_remove(authority->socket_source);
	if (authority->socket_fd >= 0)
		close(authority->socket_fd);
	if (authority->socket_path[0])
		unlink(authority->socket_path);
	if (authority->seat_initialized)
		weston_seat_release(&authority->seat);
	free(authority);
#else
	(void)authority;
#endif
}
