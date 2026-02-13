class Aion < Formula
  desc "Terminal calendar client with vim-style keybindings"
  homepage "https://github.com/semos-labs/aion"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/semos-labs/aion/releases/download/v#{version}/aion-darwin-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/semos-labs/aion/releases/download/v#{version}/aion-darwin-x64"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/semos-labs/aion/releases/download/v#{version}/aion-linux-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/semos-labs/aion/releases/download/v#{version}/aion-linux-x64"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    bin.install Dir["*"].first => "aion"
  end

  test do
    # Basic test - the app requires a terminal so just check it exists
    assert_predicate bin/"aion", :executable?
  end
end
