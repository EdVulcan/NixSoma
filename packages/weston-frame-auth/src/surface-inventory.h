#ifndef NIXSOMA_SURFACE_INVENTORY_H
#define NIXSOMA_SURFACE_INVENTORY_H

struct weston_compositor;
struct nixsoma_surface_inventory;

struct nixsoma_surface_inventory *
nixsoma_surface_inventory_create(struct weston_compositor *compositor);

void
nixsoma_surface_inventory_destroy(struct nixsoma_surface_inventory *inventory);

#endif
