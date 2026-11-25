# The game's own iCloud key-value store module (src/game/cloudSave.ts).
# Local to this repo: Expo autolinking finds everything under ./modules.
Pod::Spec.new do |s|
  s.name           = 'ICloudStore'
  s.version        = '1.0.0'
  s.summary        = 'Saves Dice Battles progress to the player\'s own iCloud.'
  s.description    = 'A small wrapper round NSUbiquitousKeyValueStore for Dice Battles.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Paper Ship Studio'
  s.homepage       = 'https://papershipstudio.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
