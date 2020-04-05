# frozen_string_literal: true

require "test_helper"

class AvatarUploaderTest < ActiveSupport::TestCase
  test "extension limit" do
    not_an_image = fixture_file_upload("test.html", "text/html")
    svg_image = fixture_file_upload("test.svg", "image/svg+xml")
    image = fixture_file_upload("test.png", "image/png")

    user = build(:user, avatar: not_an_image)
    assert_equal false, user.valid?
    assert_equal ["头像仅允许图片文件上传 [jpg, jpeg, gif, png]"], user.errors.full_messages_for(:avatar)

    user = build(:user, avatar: svg_image)
    assert_equal false, user.valid?
    assert_equal ["头像仅允许图片文件上传 [jpg, jpeg, gif, png]"], user.errors.full_messages_for(:avatar)

    user = build(:user, avatar: image)
    assert_equal true, user.valid?
  end
end
