Pod::Spec.new do |s|
  s.name         = "RivoMediaControls"
  s.version      = "1.0.0"
  s.summary      = "Rivo Media Controls for iOS"
  s.author       = "Rivo"
  s.homepage     = "https://github.com/mohamedLIOT1/liofy"
  s.license      = "MIT"
  s.platform     = :ios, "13.4"
  s.source       = { :git => "" }
  s.source_files = "*.{h,m,mm}"
  s.frameworks   = "MediaPlayer", "AVFoundation"
  s.dependency "React-Core"
end
