{ lib, buildNpmPackage, fetchNpmDeps, stdenv }:

let
  mkOpenClawNpmRuntimeClosure = import ../lib/mk-openclaw-npm-runtime-closure.nix {
    inherit lib buildNpmPackage fetchNpmDeps;
  };
  hostdRuntimeModules = lib.fileset.fileFilter
    (file: file.hasExt "mjs")
    ../../services/openclaw-hostd/src;
in
mkOpenClawNpmRuntimeClosure {
  pname = "openclaw-hostd";
  serviceName = "openclaw-hostd";
  servicePath = ../../services/openclaw-hostd;
  npmDepsHash = "sha256-eMT6IhmcIqn9UeeHeN1n7bt0YK9lJ6PgcxLq8oZjUMw=";
  nativeBuildInputs = [ stdenv.cc ];
  extraPostInstall = ''
    mkdir -p "$out/bin"
    "$CC" -O2 -Wall -Wextra -Werror \
      -o "$out/bin/openclaw-hostd-peer-credentials" \
      services/openclaw-hostd/src/openclaw-hostd-peer-credentials.c
  '';
  files = [
    ../../services/openclaw-hostd/package.json
    ../../services/openclaw-hostd/package-lock.json
    hostdRuntimeModules
    ../../services/openclaw-hostd/src/openclaw-hostd-peer-credentials.c
    ../../packages/shared-systemd/src/systemd-dbus-transport.mjs
    ../../packages/shared-systemd/src/openclaw-hostd-capabilities.json
    ../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs
    ../../packages/shared-systemd/src/openclaw-hostd-activation.mjs
  ];
}
