#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include <libweston/desktop.h>
#include <libweston/libweston.h>

#include "surface-inventory.h"

#ifndef NIXSOMA_SURFACE_INVENTORY_ENABLED
#define NIXSOMA_SURFACE_INVENTORY_ENABLED 0
#endif

#define SURFACE_DIRECTORY "surfaces"
#define SURFACE_INVENTORY_FILE "current.json"
#define SURFACE_INVENTORY_MAX_ITEMS 16
#define SURFACE_INVENTORY_MAX_BYTES 8192

struct tracked_surface {
	struct wl_list link;
	struct nixsoma_surface_inventory *inventory;
	struct weston_surface *surface;
	struct wl_listener map_listener;
	struct wl_listener unmap_listener;
	struct wl_listener destroy_listener;
};

struct surface_record {
	uint32_t surface_id;
	pid_t pid;
	int32_t width;
	int32_t height;
	bool activated;
};

struct nixsoma_surface_inventory {
	struct weston_compositor *compositor;
	struct wl_list tracked_surfaces;
	struct wl_listener create_surface_listener;
	struct wl_listener activate_listener;
	struct wl_event_source *publish_idle_source;
	char inventory_path[PATH_MAX];
	char temporary_path[PATH_MAX];
	uint32_t sequence;
};

#if NIXSOMA_SURFACE_INVENTORY_ENABLED
static bool
write_all(int fd, const char *buffer, size_t length)
{
	while (length > 0) {
		ssize_t written = write(fd, buffer, length);
		if (written < 0 && errno == EINTR)
			continue;
		if (written <= 0)
			return false;
		buffer += written;
		length -= (size_t)written;
	}
	return true;
}

static int
compare_surface_records(const void *left, const void *right)
{
	const struct surface_record *a = left;
	const struct surface_record *b = right;

	if (a->surface_id < b->surface_id)
		return -1;
	if (a->surface_id > b->surface_id)
		return 1;
	return 0;
}

static size_t
collect_surface_records(struct nixsoma_surface_inventory *inventory,
			struct surface_record *records, bool *truncated)
{
	struct tracked_surface *tracked;
	size_t count = 0;

	*truncated = false;
	wl_list_for_each(tracked, &inventory->tracked_surfaces, link) {
		struct weston_surface *surface = tracked->surface;
		struct weston_desktop_surface *desktop_surface;
		struct weston_geometry geometry;

		if (!surface->is_mapped || !weston_surface_is_desktop_surface(surface) ||
		    weston_surface_get_main_surface(surface) != surface)
			continue;
		if (count >= SURFACE_INVENTORY_MAX_ITEMS) {
			*truncated = true;
			continue;
		}
		desktop_surface = weston_surface_get_desktop_surface(surface);
		if (!desktop_surface)
			continue;
		geometry = weston_desktop_surface_get_geometry(desktop_surface);
		records[count++] = (struct surface_record) {
			.surface_id = surface->s_id,
			.pid = weston_desktop_surface_get_pid(desktop_surface),
			.width = geometry.width > 0 ? geometry.width : surface->width,
			.height = geometry.height > 0 ? geometry.height : surface->height,
			.activated = weston_desktop_surface_get_activated(desktop_surface),
		};
	}
	qsort(records, count, sizeof(records[0]), compare_surface_records);
	return count;
}

static bool
append_document(char *document, size_t capacity, size_t *offset,
		const char *format, ...)
{
	va_list arguments;
	int written;

	if (*offset >= capacity)
		return false;
	va_start(arguments, format);
	written = vsnprintf(document + *offset, capacity - *offset, format, arguments);
	va_end(arguments);
	if (written < 0 || (size_t)written >= capacity - *offset)
		return false;
	*offset += (size_t)written;
	return true;
}

static bool
publish_inventory(struct nixsoma_surface_inventory *inventory)
{
	struct surface_record records[SURFACE_INVENTORY_MAX_ITEMS];
	char document[SURFACE_INVENTORY_MAX_BYTES];
	size_t count;
	size_t offset = 0;
	size_t index;
	bool truncated;
	int fd;
	bool ok;

	count = collect_surface_records(inventory, records, &truncated);
	inventory->sequence++;
	if (!append_document(document, sizeof(document), &offset,
			"{\"registry\":\"nixsoma-ai-surface-inventory-v0\","
			"\"sequence\":%u,\"socketName\":\"nixsoma-ai-0\","
			"\"count\":%zu,\"truncated\":%s,\"surfaces\":[",
			inventory->sequence, count, truncated ? "true" : "false"))
		return false;
	for (index = 0; index < count; index++) {
		if (!append_document(document, sizeof(document), &offset,
				"%s{\"surfaceId\":%u,\"pid\":%ld,\"width\":%d,"
				"\"height\":%d,\"activated\":%s}",
				index ? "," : "", records[index].surface_id,
				(long)records[index].pid, records[index].width,
				records[index].height,
				records[index].activated ? "true" : "false"))
			return false;
	}
	if (!append_document(document, sizeof(document), &offset,
			"],\"boundary\":{\"sourceScope\":"
			"\"ai_owned_nested_output_only\",\"titleExposed\":false,"
			"\"pixelsExposed\":false,\"parentDisplayConnected\":false,"
			"\"inputAuthorityExpanded\":false,\"persisted\":false}}\n"))
		return false;

	fd = open(inventory->temporary_path,
		  O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC | O_NOFOLLOW, 0600);
	if (fd < 0)
		return false;
	ok = write_all(fd, document, offset) && fsync(fd) == 0;
	if (close(fd) < 0)
		ok = false;
	if (!ok || rename(inventory->temporary_path, inventory->inventory_path) < 0) {
		unlink(inventory->temporary_path);
		return false;
	}
	return true;
}

static void
publish_inventory_idle(void *data)
{
	struct nixsoma_surface_inventory *inventory = data;

	inventory->publish_idle_source = NULL;
	if (!publish_inventory(inventory))
		weston_log("NixSoma surface inventory publish failed: %s\n",
			   strerror(errno));
}

static void
schedule_inventory_publish(struct nixsoma_surface_inventory *inventory)
{
	struct wl_event_loop *loop;

	if (inventory->publish_idle_source)
		return;
	loop = wl_display_get_event_loop(inventory->compositor->wl_display);
	inventory->publish_idle_source = wl_event_loop_add_idle(
		loop, publish_inventory_idle, inventory);
}

static void
surface_changed(struct wl_listener *listener, void *data)
{
	struct tracked_surface *tracked =
		wl_container_of(listener, tracked, map_listener);

	(void)data;
	schedule_inventory_publish(tracked->inventory);
}

static void
surface_unmapped(struct wl_listener *listener, void *data)
{
	struct tracked_surface *tracked =
		wl_container_of(listener, tracked, unmap_listener);

	(void)data;
	schedule_inventory_publish(tracked->inventory);
}

static void
surface_destroyed(struct wl_listener *listener, void *data)
{
	struct tracked_surface *tracked =
		wl_container_of(listener, tracked, destroy_listener);
	struct nixsoma_surface_inventory *inventory = tracked->inventory;

	(void)data;
	wl_list_remove(&tracked->map_listener.link);
	wl_list_remove(&tracked->unmap_listener.link);
	wl_list_remove(&tracked->destroy_listener.link);
	wl_list_remove(&tracked->link);
	free(tracked);
	schedule_inventory_publish(inventory);
}

static void
surface_created(struct wl_listener *listener, void *data)
{
	struct nixsoma_surface_inventory *inventory =
		wl_container_of(listener, inventory, create_surface_listener);
	struct weston_surface *surface = data;
	struct tracked_surface *tracked = calloc(1, sizeof(*tracked));

	if (!tracked) {
		weston_log("NixSoma surface inventory could not track a surface.\n");
		return;
	}
	tracked->inventory = inventory;
	tracked->surface = surface;
	tracked->map_listener.notify = surface_changed;
	tracked->unmap_listener.notify = surface_unmapped;
	tracked->destroy_listener.notify = surface_destroyed;
	wl_signal_add(&surface->map_signal, &tracked->map_listener);
	wl_signal_add(&surface->unmap_signal, &tracked->unmap_listener);
	wl_signal_add(&surface->destroy_signal, &tracked->destroy_listener);
	wl_list_insert(&inventory->tracked_surfaces, &tracked->link);
}

static void
surface_activated(struct wl_listener *listener, void *data)
{
	struct nixsoma_surface_inventory *inventory =
		wl_container_of(listener, inventory, activate_listener);

	(void)data;
	schedule_inventory_publish(inventory);
}
#endif

struct nixsoma_surface_inventory *
nixsoma_surface_inventory_create(struct weston_compositor *compositor)
{
#if NIXSOMA_SURFACE_INVENTORY_ENABLED
	struct nixsoma_surface_inventory *inventory;
	const char *runtime_directory = getenv("XDG_RUNTIME_DIR");
	char surface_directory[PATH_MAX];
	struct stat directory_stat;
	int written;

	if (!runtime_directory || runtime_directory[0] != '/')
		return NULL;
	inventory = calloc(1, sizeof(*inventory));
	if (!inventory)
		return NULL;
	inventory->compositor = compositor;
	wl_list_init(&inventory->tracked_surfaces);
	written = snprintf(surface_directory, sizeof(surface_directory), "%s/%s",
			   runtime_directory, SURFACE_DIRECTORY);
	if (written < 0 || (size_t)written >= sizeof(surface_directory) ||
	    stat(surface_directory, &directory_stat) < 0 ||
	    !S_ISDIR(directory_stat.st_mode) || directory_stat.st_uid != getuid() ||
	    (directory_stat.st_mode & 0077) != 0)
		goto fail;
	written = snprintf(inventory->inventory_path,
			   sizeof(inventory->inventory_path), "%s/%s",
			   surface_directory, SURFACE_INVENTORY_FILE);
	if (written < 0 || (size_t)written >= sizeof(inventory->inventory_path))
		goto fail;
	written = snprintf(inventory->temporary_path,
			   sizeof(inventory->temporary_path), "%s.tmp",
			   inventory->inventory_path);
	if (written < 0 || (size_t)written >= sizeof(inventory->temporary_path))
		goto fail;
	inventory->create_surface_listener.notify = surface_created;
	inventory->activate_listener.notify = surface_activated;
	wl_signal_add(&compositor->create_surface_signal,
		      &inventory->create_surface_listener);
	wl_signal_add(&compositor->activate_signal, &inventory->activate_listener);
	if (!publish_inventory(inventory))
		goto fail_listeners;
	weston_log("NixSoma bounded surface inventory is ready.\n");
	return inventory;

fail_listeners:
	wl_list_remove(&inventory->activate_listener.link);
	wl_list_remove(&inventory->create_surface_listener.link);
fail:
	free(inventory);
	return NULL;
#else
	(void)compositor;
	return (struct nixsoma_surface_inventory *)(uintptr_t)1;
#endif
}

void
nixsoma_surface_inventory_destroy(struct nixsoma_surface_inventory *inventory)
{
#if NIXSOMA_SURFACE_INVENTORY_ENABLED
	struct tracked_surface *tracked;
	struct tracked_surface *temporary;

	if (!inventory)
		return;
	if (inventory->publish_idle_source)
		wl_event_source_remove(inventory->publish_idle_source);
	wl_list_for_each_safe(tracked, temporary,
			      &inventory->tracked_surfaces, link) {
		wl_list_remove(&tracked->map_listener.link);
		wl_list_remove(&tracked->unmap_listener.link);
		wl_list_remove(&tracked->destroy_listener.link);
		wl_list_remove(&tracked->link);
		free(tracked);
	}
	wl_list_remove(&inventory->activate_listener.link);
	wl_list_remove(&inventory->create_surface_listener.link);
	unlink(inventory->temporary_path);
	unlink(inventory->inventory_path);
	free(inventory);
#else
	(void)inventory;
#endif
}
