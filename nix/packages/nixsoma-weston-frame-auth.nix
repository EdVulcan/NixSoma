{ lib, stdenv, pkg-config, weston, wayland, pixman, libxkbcommon
, nativeInput ? false, outputWidth ? 1280, outputHeight ? 720 }:

stdenv.mkDerivation {
  pname = "nixsoma-weston-frame-auth";
  version = "0.1.0";

  src = lib.fileset.toSource {
    root = ../..;
    fileset = ../../packages/weston-frame-auth/src;
  };

  nativeBuildInputs = [ pkg-config ];
  buildInputs = [ weston wayland pixman libxkbcommon ];

  buildPhase = ''
    runHook preBuild
    $CC -std=c11 -O2 -fPIC -shared -Wall -Wextra -Werror \
      $(pkg-config --static --cflags weston libweston-15) \
      -DNIXSOMA_CAPTURE_HELPER='"${weston}/bin/weston-screenshooter"' \
      -DNIXSOMA_INPUT_ENABLED=${if nativeInput then "1" else "0"} \
      -DNIXSOMA_OUTPUT_WIDTH=${toString outputWidth} \
      -DNIXSOMA_OUTPUT_HEIGHT=${toString outputHeight} \
      packages/weston-frame-auth/src/frame-auth.c \
      packages/weston-frame-auth/src/input-authority.c \
      $(pkg-config --libs weston libweston-15) \
      -L${weston}/lib/weston -lexec_weston \
      -Wl,-rpath,${weston}/lib/weston \
      -o nixsoma-weston-frame-auth.so
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm555 nixsoma-weston-frame-auth.so \
      "$out/lib/weston/nixsoma-weston-frame-auth.so"
    runHook postInstall
  '';
}
