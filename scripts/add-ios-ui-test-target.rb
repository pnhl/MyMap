#!/usr/bin/env ruby
# frozen_string_literal: true

require 'fileutils'
require 'xcodeproj'

ROOT = File.expand_path('..', __dir__)
IOS_DIR = File.join(ROOT, 'ios')
TEST_SOURCE = File.join(ROOT, 'ios-tests', 'MyMapUITests', 'MyMapSmokeTests.swift')
TEST_DIR = File.join(IOS_DIR, 'MyMapUITests')
TEST_DEST = File.join(TEST_DIR, 'MyMapSmokeTests.swift')

app_target_name = ENV.fetch('MYMAP_IOS_APP_TARGET', 'MyMap')
test_target_name = ENV.fetch('MYMAP_IOS_TEST_TARGET', 'MyMapUITests')
scheme_name = ENV.fetch('MYMAP_IOS_TEST_SCHEME', 'MyMapFirebaseTests')

project_path = Dir[File.join(IOS_DIR, '*.xcodeproj')].first
abort "No Xcode project found under #{IOS_DIR}" unless project_path
abort "Missing test source: #{TEST_SOURCE}" unless File.file?(TEST_SOURCE)

FileUtils.mkdir_p(TEST_DIR)
FileUtils.cp(TEST_SOURCE, TEST_DEST)

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == app_target_name }
abort "App target '#{app_target_name}' not found. Available: #{project.targets.map(&:name).join(', ')}" unless app_target

# Remove an old generated test target so repeated CI runs remain deterministic.
if (old_target = project.targets.find { |target| target.name == test_target_name })
  old_target.remove_from_project
end

# Clean up any stale generated group.
if (old_group = project.main_group.groups.find { |group| group.display_name == test_target_name })
  old_group.remove_from_project
end

# Reuse the app's deployment target where possible.
deployment_target = app_target.build_configurations
                              .map { |config| config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] }
                              .compact
                              .reject(&:empty?)
                              .first || '16.4'

bundle_id = app_target.build_configurations
                      .map { |config| config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] }
                      .compact
                      .reject(&:empty?)
                      .first || 'com.pnhl.vibecoding'

ui_target = project.new_target(:ui_test_bundle, test_target_name, :ios, deployment_target)
ui_target.add_dependency(app_target)
ui_target.add_system_framework('XCTest')

test_group = project.main_group.new_group(test_target_name, test_target_name)
source_ref = test_group.new_file('MyMapSmokeTests.swift')
ui_target.add_file_references([source_ref])

ui_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "#{bundle_id}.MyMapUITests"
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['TEST_TARGET_NAME'] = app_target_name
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
end

project.save

# Generate a dedicated shared scheme containing exactly the app + UI test target.
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app_target)
scheme.add_build_target(ui_target, false)
scheme.add_test_target(ui_target)
scheme.save_as(project_path, scheme_name, true)

puts "Added #{test_target_name} to #{File.basename(project_path)}"
puts "Shared scheme: #{scheme_name}"
puts "Deployment target: iOS #{deployment_target}"
puts "Test bundle id: #{bundle_id}.MyMapUITests"
