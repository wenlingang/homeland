# frozen_string_literal: true

ENV["RAILS_ENV"] = "test"
ENV["upload_provider"] = "file"

require_relative "../config/environment"
require "minitest/autorun"
require "mocha/minitest"
require "rails/test_help"
require "sidekiq/testing"
require "simplecov"

SimpleCov.start
if ENV["CI"] == "true"
  require "codecov"
  SimpleCov.formatter = SimpleCov::Formatter::Codecov
end

FileUtils.mkdir_p(Rails.root.join("tmp/cache"))


OmniAuth.config.test_mode = true
Devise.stretches = 1
Rails.logger.level = 4
FactoryBot.use_parent_strategy = false
DatabaseCleaner.orm = :active_record
DatabaseCleaner.strategy = :truncation


ActiveRecord::Base.connection.create_table(:monkeys, force: true) do |t|
  t.string :name
  t.integer :user_id
  t.integer :comments_count
  t.timestamps null: false
end

ActiveRecord::Base.connection.create_table(:commentable_pages, force: true) do |t|
  t.string :name
  t.integer :user_id
  t.integer :comments_count, default: 0, null: false
  t.timestamps null: false
end

class CommentablePage < ApplicationRecord
end

class Monkey < ApplicationRecord
end

class ActiveSupport::TestCase
  include FactoryBot::Syntax::Methods

  setup do
    Setting.stubs(:topic_create_limit_interval).returns("")
    Setting.stubs(:topic_create_hour_limit_count).returns("")

    # Database cleaner
    DatabaseCleaner.clean
    Rails.cache.clear

    Monkey.delete_all
    CommentablePage.delete_all
  end

  def read_file(fname)
    load_file(fname).read.strip
  end

  def load_file(fname)
    File.open(Rails.root.join("test", "fixtures", fname))
  end

  def assert_html_equal(excepted, html)
    assert_equal excepted.strip.gsub(/>[\s]+</, "><"), html.strip.gsub(/>[\s]+</, "><")
  end

  def assert_has_keys(collection, *keys)
    keys.each do |key|
      assert_equal true, collection.has_key?(key)
    end
  end

  def assert_includes_all(collection, *other)
    other.each do |item|
      assert_includes collection, item
    end
  end

  def assert_not_includes_any(collection, *other)
    other.each do |item|
      assert_not_includes collection, item
    end
  end

  def fixture_file_upload(name, content_type = "text/plain")
    Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/#{name}"), content_type)
  end
end

class ActionView::TestCase
  def sign_in(user)
    @user = user
  end

  def sign_out
    @user = nil
  end

  def current_user; @user; end
end


class ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  def assert_require_user(&block)
    yield block
    assert_equal 302, response.status
    assert_match /\/account\/sign_in/, response.headers["Location"]
  end
end