{ weston }:

weston.overrideAttrs (previous: {
  pname = "nixsoma-weston";

  patches = (previous.patches or [ ]) ++ [
    ../patches/weston-kiosk-shell-nixsoma-activation-api.patch
  ];

  postPatch = (previous.postPatch or "") + ''
    install -Dm444 \
      ${../../packages/weston-frame-auth/src/nixsoma-kiosk-shell-activation-api.h} \
      include/libweston/nixsoma-kiosk-shell-activation-api.h
  '';
})
