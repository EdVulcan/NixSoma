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
    cp -R services packages "$out/share/openclaw/"
    runHook postInstall
  '';
}
