{ lib, stdenv, clang, elfutils, libbpf, linuxHeaders, makeWrapper, zlib }:

stdenv.mkDerivation {
  pname = "openclaw-kernel-event-probe";
  version = "0.1.0";
  dontStrip = true;
  src = lib.fileset.toSource {
    root = ../..;
    fileset = lib.fileset.unions [
      ../../packages/kernel-event-probe/src
    ];
  };
  nativeBuildInputs = [ clang makeWrapper ];
  buildInputs = [ elfutils libbpf zlib ];

  buildPhase = ''
    runHook preBuild
    clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
      -I${linuxHeaders}/include \
      -I${libbpf}/include \
      -c src/openclaw-kernel-process-exec.bpf.c \
      -o openclaw-kernel-process-exec.bpf.o
    $CC -O2 -g -I${libbpf}/include \
      src/openclaw-kernel-process-exec-loader.c \
      -L${libbpf}/lib -L${elfutils}/lib -L${zlib}/lib \
      -Wl,-rpath,${lib.makeLibraryPath [ elfutils libbpf zlib ]} \
      -lbpf -lelf -lz \
      -o openclaw-kernel-process-exec-loader
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm444 openclaw-kernel-process-exec.bpf.o \
      "$out/lib/openclaw-kernel-process-exec.bpf.o"
    install -Dm755 openclaw-kernel-process-exec-loader \
      "$out/libexec/openclaw-kernel-process-exec-loader"
    makeWrapper "$out/libexec/openclaw-kernel-process-exec-loader" \
      "$out/bin/openclaw-kernel-process-exec" \
      --add-flags "--object-path $out/lib/openclaw-kernel-process-exec.bpf.o"
    runHook postInstall
  '';
}
