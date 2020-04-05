# frozen_string_literal: true

require "test_helper"

class TopicsHelperTest < ActionView::TestCase
  include ApplicationHelper

  test "topic_favorite_tag" do
    user = create :user
    topic = create :topic

    assert_equal "", topic_favorite_tag(nil)

    # should result when logined user did not favorite topic
    sign_in user
    user.stub(:favorite_topic?, false) do
      res = topic_favorite_tag(topic)
      assert_equal "<a title=\"收藏\" class=\"bookmark \" data-id=\"#{topic.id}\" href=\"#\"><i class=\"fa fa-bookmark\"></i> 收藏</a>", res
    end

    # should result when logined user favorited topic
    user.stub(:favorite_topic?, true) do
      assert_equal "<a title=\"取消收藏\" class=\"bookmark active\" data-id=\"#{topic.id}\" href=\"#\"><i class=\"fa fa-bookmark\"></i> 收藏</a>", topic_favorite_tag(topic)
    end

    # should result blank when unlogin user
    sign_out
    assert_equal "", topic_favorite_tag(topic)
  end

  test "topic_title_tag" do
    topic = create :topic, title: "test title"
    user = create :user

    # should return topic_was_deleted without a topic
    assert_equal t("topics.topic_was_deleted"), topic_title_tag(nil)

    # should return title with a topic
    assert_equal "<a title=\"#{topic.title}\" href=\"/topics/#{topic.id}\">#{topic.title}</a>", topic_title_tag(topic)
  end

  test "topic_follow_tag" do
    user = create :user
    topic = create :topic

    # should return empty when current_user is nil
    assert_equal "", topic_follow_tag(topic)

    # should return empty when is owner
    sign_in topic.user
    assert_equal "", topic_follow_tag(topic)

    # should return empty when topic is nil
    sign_in user
    assert_equal "", topic_follow_tag(nil)

    # was unfollow
    assert_equal "<a data-id=\"#{topic.id}\" class=\"follow\" href=\"#\"><i class=\"fa fa-eye\"></i> 关注</a>", topic_follow_tag(topic)

    # was active
    user.stub(:follow_topic?, true) do
      assert_equal "<a data-id=\"#{topic.id}\" class=\"follow active\" href=\"#\"><i class=\"fa fa-eye\"></i> 关注</a>", topic_follow_tag(topic)
    end
  end
end
