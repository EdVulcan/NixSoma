{ lib, stdenv, clang, llvmPackages, elfutils, libbpf, linuxHeaders, makeWrapper, zlib }:

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
    ${llvmPackages.clang-unwrapped}/bin/clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
      -I${linuxHeaders}/include \
      -I${libbpf}/include \
      -c packages/kernel-event-probe/src/openclaw-kernel-process-exec.bpf.c \
      -o openclaw-kernel-process-exec.bpf.o
    ${llvmPackages.clang-unwrapped}/bin/clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
      -I${linuxHeaders}/include \
      -I${libbpf}/include \
      -c packages/kernel-event-probe/src/openclaw-kernel-network-connect.bpf.c \
      -o openclaw-kernel-network-connect.bpf.o
    ${llvmPackages.clang-unwrapped}/bin/clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
      -I${linuxHeaders}/include \
      -I${libbpf}/include \
      -c packages/kernel-event-probe/src/openclaw-kernel-file-open.bpf.c \
      -o openclaw-kernel-file-open.bpf.o
    $CC -O2 -g -I${libbpf}/include \
      packages/kernel-event-probe/src/openclaw-kernel-process-exec-loader.c \
      -L${libbpf}/lib -L${elfutils}/lib -L${zlib}/lib \
      -Wl,-rpath,${lib.makeLibraryPath [ elfutils libbpf zlib ]} \
      -lbpf -lelf -lz \
      -o openclaw-kernel-process-exec-loader
    $CC -O2 -g -I${libbpf}/include \
      packages/kernel-event-probe/src/openclaw-kernel-network-connect-loader.c \
      -L${libbpf}/lib -L${elfutils}/lib -L${zlib}/lib \
      -Wl,-rpath,${lib.makeLibraryPath [ elfutils libbpf zlib ]} \
      -lbpf -lelf -lz \
      -o openclaw-kernel-network-connect-loader
    $CC -O2 -g -I${libbpf}/include \
      packages/kernel-event-probe/src/openclaw-kernel-file-open-loader.c \
      -L${libbpf}/lib -L${elfutils}/lib -L${zlib}/lib \
      -Wl,-rpath,${lib.makeLibraryPath [ elfutils libbpf zlib ]} \
      -lbpf -lelf -lz \
      -o openclaw-kernel-file-open-loader
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
    install -Dm444 openclaw-kernel-network-connect.bpf.o \
      "$out/lib/openclaw-kernel-network-connect.bpf.o"
    install -Dm755 openclaw-kernel-network-connect-loader \
      "$out/libexec/openclaw-kernel-network-connect-loader"
    makeWrapper "$out/libexec/openclaw-kernel-network-connect-loader" \
      "$out/bin/openclaw-kernel-network-connect" \
      --add-flags "--object-path $out/lib/openclaw-kernel-network-connect.bpf.o"
    install -Dm444 openclaw-kernel-file-open.bpf.o \
      "$out/lib/openclaw-kernel-file-open.bpf.o"
    install -Dm755 openclaw-kernel-file-open-loader \
      "$out/libexec/openclaw-kernel-file-open-loader"
    makeWrapper "$out/libexec/openclaw-kernel-file-open-loader" \
      "$out/bin/openclaw-kernel-file-open" \
      --add-flags "--object-path $out/lib/openclaw-kernel-file-open.bpf.o"
    runHook postInstall
  '';
}
