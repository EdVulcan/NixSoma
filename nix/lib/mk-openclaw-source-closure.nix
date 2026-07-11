{ lib, stdenvNoCC }:

{ pname, files, version ? "0.1.0" }:

stdenvNoCC.mkDerivation {
  inherit pname version;

  src = lib.fileset.toSource {
    root = ../..;
    fileset = lib.fileset.unions files;
  };

  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/share/openclaw"
    for sourceRoot in apps services packages; do
      if [ -d "$sourceRoot" ]; then
        cp -R "$sourceRoot" "$out/share/openclaw/"
      fi
    done
    runHook postInstall
  '';
}
