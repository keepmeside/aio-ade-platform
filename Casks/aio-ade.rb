cask "aio-ade" do
  arch arm: "arm64", intel: "x64"

  # Templated by .github/workflows/homebrew-bump.yml on each stable release.
  version "1.3.24"
  sha256 arm:   "fc707f290ff3b631b7b7947bf339885b61a43d2e89475997c125b61268ed4966",
         intel: "5f677c13a08f7a5740442e29d388285a86488c8c1f7aa5f10a8721a2c6ede8e4"

  url "https://github.com/keepmeside/aio-ade-platform/releases/download/v#{version}/aio-ade-macos-#{arch}.dmg",
      verified: "github.com/keepmeside/aio-ade-platform/"
  name "AIO-ADE"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://github.com/keepmeside/aio-ade-platform"

  livecheck do
    url :url
    strategy :github_latest
  end

  # Why: there is exactly one channel. The upstream project also shipped an `@rc` cask, and the
  # two declared `conflicts_with` each other; this fork ships stable only, so neither the RC cask
  # nor the conflict declaration exists.
  #
  # Why not `auto_updates true`: that flag tells Homebrew to stand aside for an in-app updater, so
  # `brew upgrade` becomes a no-op without `--greedy`. This build ships with the updater disabled
  # (the artifacts are unsigned, so an unauthenticated update channel is not something to point at
  # users), which makes Homebrew the only upgrade path. Claiming auto_updates here would strand
  # installs on whatever version they first got.
  depends_on macos: :big_sur

  app "AIO-ADE.app"

  # Why: expose the bundled `aio-ade` CLI on PATH at install time (Homebrew symlinks this into its
  # already-on-PATH bin dir). Without it the CLI is only registered by the in-app "Install CLI"
  # action, which a headless host can never trigger. The shim resolves the real app by walking
  # symlinks, so the Homebrew symlink works.
  binary "#{appdir}/AIO-ADE.app/Contents/Resources/bin/aio-ade"

  # Why: the artifacts are not yet signed or notarized, so macOS quarantines the download and
  # Gatekeeper refuses it on first launch. Homebrew strips the quarantine attribute itself, which
  # is why a cask install does not hit the warning a manual DMG download does.
  caveats do
    <<~EOS
      AIO-ADE is not yet code-signed or notarized. Homebrew removes the quarantine attribute on
      install, so no extra step is needed here. A DMG downloaded manually from GitHub Releases
      does need one: right-click the app and choose Open, or run
        xattr -d com.apple.quarantine /Applications/AIO-ADE.app
    EOS
  end

  # Why: the app writes user data under ~/.aio-ade (worktrees, agent state) and Electron's standard
  # userData directories. The pre-rebrand locations are listed too: an install that upgraded through
  # the rename copied its data forward but deliberately never deleted the originals, so a zap that
  # omitted them would leave the old tree behind on uninstall.
  zap trash: [
    "~/.aio-ade",
    "~/.orca",
    "~/Library/Application Support/AIO-ADE",
    "~/Library/Application Support/Orca",
    "~/Library/Caches/com.keepmeside.aio-ade",
    "~/Library/Caches/com.keepmeside.aio-ade.ShipIt",
    "~/Library/Caches/com.stablyai.orca",
    "~/Library/Caches/com.stablyai.orca.ShipIt",
    "~/Library/HTTPStorages/com.keepmeside.aio-ade",
    "~/Library/HTTPStorages/com.stablyai.orca",
    "~/Library/Preferences/com.keepmeside.aio-ade.plist",
    "~/Library/Preferences/com.stablyai.orca.plist",
    "~/Library/Saved Application State/com.keepmeside.aio-ade.savedState",
    "~/Library/Saved Application State/com.stablyai.orca.savedState",
  ]
end
