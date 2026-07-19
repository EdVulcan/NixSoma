{
  imports = [
    ../profiles/desktop-body.nix
  ];

  # This flake output is an evaluation/build harness, not the physical host.
  boot.isContainer = true;
  system.stateVersion = "25.05";
}
