#ifndef NIXSOMA_KIOSK_SHELL_ACTIVATION_API_H
#define NIXSOMA_KIOSK_SHELL_ACTIVATION_API_H

#include <stdbool.h>
#include <stdint.h>

#define NIXSOMA_KIOSK_SHELL_ACTIVATION_API_NAME \
	"nixsoma_kiosk_shell_activation_v1"

struct weston_compositor;
struct weston_seat;

struct nixsoma_kiosk_shell_activation_api {
	bool (*activate_surface)(struct weston_compositor *compositor,
				 struct weston_seat *seat,
				 uint32_t surface_id);
};

#endif
