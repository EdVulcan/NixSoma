#ifndef NIXSOMA_INPUT_AUTHORITY_H
#define NIXSOMA_INPUT_AUTHORITY_H

struct nixsoma_input_authority;
struct weston_compositor;

struct nixsoma_input_authority *
nixsoma_input_authority_create(struct weston_compositor *compositor);

void
nixsoma_input_authority_destroy(struct nixsoma_input_authority *authority);

#endif
