//= require jquery2
//= require popper
//= require bootstrap
//= require jquery_ujs
//= require jquery.mobile-events
//= require underscore
//= require backbone
//= require pagination
//= require jquery.timeago
//= require jquery.timeago.settings
//= require jquery.hotkeys
//= require jquery.autogrow-textarea
//= require tooltipster.bundle.min
//= require dropzone
//= require jquery.fluidbox.min
//= require social-share-button
//= require social-share-button/wechat
//= require jquery.atwho
//= require emoji-data
//= require emoji-modal
//= require notifier
//= require action_cable
//= require form_storage
//= require topics
//= require editor
//= require toc
//= require turbolinks
//= require google_analytics
//= require jquery.infinitescroll.min
//= require d3.min
//= require cal-heatmap.min
//= require_self

const AppView = Backbone.View.extend({
  el: "body",
  repliesPerPage: 50,
  windowInActive: true,

  events: {
    "click a.likeable": "likeable",
    "click .header .form-search .btn-search": "openHeaderSearchBox",
    "click .header .form-search .btn-close": "closeHeaderSearchBox",
    "click a.button-block-user": "blockUser",
    "click a.button-follow-user": "followUser",
    "click a.button-block-node": "blockNode",
    "click a.rucaptcha-image-box": "reLoadRucaptchaImage"
  },

  initialize() {
    let needle;
    FormStorage.restore();
    this.initForDesktopView();
    this.initComponents();
    this.initScrollEvent();
    this.initInfiniteScroll();
    this.initCable();
    this.restoreHeaderSearchBox();

    if ((needle = $('body').data('controller-name'), ['topics', 'replies'].includes(needle))) {
      window._topicView = new TopicView({ parentView: this });
    }

    return window._tocView = new TOCView({ parentView: this });
  },

  initComponents() {
    $("abbr.timeago").timeago();
    $(".alert").alert();
    $('.dropdown-toggle').dropdown();
    $('[data-toggle="tooltip"]').tooltip();

    // 绑定评论框 Ctrl+Enter 提交事件
    $(".cell_comments_new textarea").unbind("keydown");
    $(".cell_comments_new textarea").bind("keydown", "ctrl+return", function (el) {
      if ($(el.target).val().trim().length > 0) {
        $(el.target).parent().parent().submit();
      }
      return false;
    });

    $(window).off("blur.inactive focus.inactive");
    $(window).on("blur.inactive focus.inactive", this.updateWindowActiveState);

    // Likeable Popover
    return $('a.likeable[data-count!=0]').tooltipster({
      content: "Loading...",
      theme: 'tooltipster-shadow',
      side: 'bottom',
      maxWidth: 230,
      interactive: true,
      contentAsHTML: true,
      triggerClose: {
        mouseleave: true
      },
      functionBefore(instance, helper) {
        const $target = $(helper.origin);
        if ($target.data('remote-loaded') === 1) {
          return;
        }

        const likeable_type = $target.data("type");
        const likeable_id = $target.data("id");
        const data = {
          type: likeable_type,
          id: likeable_id
        };
        return $.ajax({
          url: '/likes',
          data,
          success(html) {
            if (html.length === 0) {
              $target.data('remote-loaded', 1);
              instance.hide();
              return instance.destroy();
            } else {
              instance.content(html);
              return $target.data('remote-loaded', 1);
            }
          }
        });
      }
    });
  },

  initForDesktopView() {
    if (App.mobile !== false) { return; }
    $("a[rel=twipsy]").tooltip();

    // CommentAble @ 回复功能
    return App.mentionable(".cell_comments_new textarea");
  },

  likeable(e) {
    if (!App.isLogined()) {
      location.href = "/account/sign_in";
      return false;
    }

    const $target = $(e.currentTarget);
    const likeable_type = $target.data("type");
    const likeable_id = $target.data("id");
    let likes_count = parseInt($target.data("count"));

    const $el = $(`.likeable[data-type='${likeable_type}'][data-id='${likeable_id}']`);

    if ($el.data("state") !== "active") {
      $.ajax({
        url: "/likes",
        type: "POST",
        data: {
          type: likeable_type,
          id: likeable_id
        }
      });

      likes_count += 1;
      $el.data('count', likes_count);
      this.likeableAsLiked($el);
    } else {
      $.ajax({
        url: `/likes/${likeable_id}`,
        type: "DELETE",
        data: {
          type: likeable_type
        }
      });
      if (likes_count > 0) {
        likes_count -= 1;
      }
      $el.data("state", "").data('count', likes_count).attr("title", "").removeClass("active");
      if (likes_count === 0) {
        $('span', $el).text("");
      } else {
        $('span', $el).text(`${likes_count} 个赞`);
      }
    }
    $el.data("remote-loaded", 0);
    return false;
  },

  likeableAsLiked(el) {
    const likes_count = el.data("count");
    el.data("state", "active").attr("title", "取消赞").addClass("active");
    return $('span', el).text(`${likes_count} 个赞`);
  },

  initCable() {
    if (!window.notificationChannel && App.isLogined()) {
      return window.notificationChannel = App.cable.subscriptions.create("NotificationsChannel", {
        connected() {
          return this.subscribe();
        },

        received: data => {
          return this.receivedNotificationCount(data);
        },

        subscribe() {
          return this.perform('subscribed');
        }
      }
      );
    }
  },

  receivedNotificationCount(json) {
    // console.log 'receivedNotificationCount', json
    const span = $(".notification-count span");
    const link = $(".notification-count a");
    let new_title = document.title.replace(/^\(\d+\) /, '');
    if (json.count > 0) {
      span.show();
      new_title = `(${json.count}) ${new_title}`;
      const url = App.fixUrlDash(`${App.root_url}${json.content_path}`);
      $.notifier.notify("", json.title, json.content, url);
      link.addClass("new");
    } else {
      span.hide();
      link.removeClass("new");
    }
    span.text(json.count);
    return document.title = new_title;
  },

  restoreHeaderSearchBox() {
    const $searchInput = $(".header .form-search input");

    if (location.pathname !== "/search") {
      return $searchInput.val("");
    } else {
      const results = new RegExp('[\?&]q=([^&#]*)').exec(window.location.href);
      const q = results && decodeURIComponent(results[1]);
      return $searchInput.val(q);
    }
  },

  openHeaderSearchBox(e) {
    $(".header .form-search").addClass("active");
    $(".header .form-search input").focus();
    return false;
  },

  closeHeaderSearchBox(e) {
    $(".header .form-search input").val("");
    $(".header .form-search").removeClass("active");
    return false;
  },

  followUser(e) {
    const btn = $(e.currentTarget);
    const userId = btn.data("id");
    const span = btn.find("span");
    const followerCounter = $(`.follow-info .followers[data-login=${userId}] .counter`);
    if (btn.hasClass("active")) {
      $.ajax({
        url: `/${userId}/unfollow`,
        type: "POST",
        success(res) {
          if (res.code === 0) {
            btn.removeClass('active');
            span.text("关注");
            return followerCounter.text(res.data.followers_count);
          }
        }
      });
    } else {
      $.ajax({
        url: `/${userId}/follow`,
        type: 'POST',
        success(res) {
          if (res.code === 0) {
            btn.addClass('active').attr("title", "");
            span.text("取消关注");
            return followerCounter.text(res.data.followers_count);
          }
        }
      });
    }
    return false;
  },

  blockUser(e) {
    const btn = $(e.currentTarget);
    const userId = btn.data("id");
    const span = btn.find("span");
    if (btn.hasClass("active")) {
      $.post(`/${userId}/unblock`);
      btn.removeClass('active').attr("title", "忽略后，社区首页列表将不会显示此用户发布的内容。");
      span.text("屏蔽");
    } else {
      $.post(`/${userId}/block`);
      btn.addClass('active').attr("title", "");
      span.text("取消屏蔽");
    }
    return false;
  },

  blockNode(e) {
    const btn = $(e.currentTarget);
    const nodeId = btn.data("id");
    const span = btn.find("span");
    if (btn.hasClass("active")) {
      $.post(`/nodes/${nodeId}/unblock`);
      btn.removeClass('active').attr("title", "忽略后，社区首页列表将不会显示这里的内容。");
      span.text("忽略节点");
    } else {
      $.post(`/nodes/${nodeId}/block`);
      btn.addClass('active').attr("title", "");
      span.text("取消屏蔽");
    }
    return false;
  },

  reLoadRucaptchaImage(e) {
    const btn = $(e.currentTarget);
    const img = btn.find('img:first');
    const currentSrc = img.attr('src');
    img.attr('src', currentSrc.split('?')[0] + '?' + (new Date()).getTime());
    return false;
  },

  updateWindowActiveState(e) {
    const prevType = $(this).data("prevType");

    if (prevType !== e.type) {
      switch (e.type) {
        case "blur":
          this.windowInActive = false;
          break;
        case "focus":
          this.windowInActive = true;
          break;
      }
    }

    return $(this).data("prevType", e.type);
  },

  initInfiniteScroll() {
    return $('.infinite-scroll .item-list').infinitescroll({
      nextSelector: '.pagination .next a',
      navSelector: '.pagination',
      itemSelector: '.topic, .notification-group',
      extraScrollPx: 200,
      bufferPx: 50,
      localMode: true,
      loading: {
        finishedMsg: '<div style="text-align: center; padding: 5px;">已到末尾</div>',
        msgText: '<div style="text-align: center; padding: 5px;">载入中...</div>',
        img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
      }
    });
  },

  initScrollEvent() {
    $(window).off('scroll.navbar-fixed');
    $(window).on('scroll.navbar-fixed', this.toggleNavbarFixed);
    return this.toggleNavbarFixed();
  },

  toggleNavbarFixed(e) {
    const top = $(window).scrollTop();
    if (top >= 50) {
      $(".header.navbar").addClass('navbar-fixed-active');
    } else {
      $(".header.navbar").removeClass('navbar-fixed-active');
    }

    if ($(".navbar-topic-title").length === 0) { return; }
    if (top >= 50) {
      return $(".header.navbar").addClass('fixed-title');
    } else {
      return $(".header.navbar").removeClass('fixed-title');
    }
  }
});


window.App = {
  turbolinks: false,
  mobile: false,
  locale: 'zh-CN',
  notifier: null,
  current_user_id: null,
  access_token: '',
  asset_url: '',
  twemoji_url: 'https://twemoji.maxcdn.com/',
  root_url: '',
  cable: ActionCable.createConsumer(),

  isLogined() {
    return document.getElementsByName('current-user').length > 0;
  },

  loading() {
    return console.log("loading...");
  },

  fixUrlDash(url) {
    return url.replace(/\/\//g, "/").replace(/:\//, "://");
  },

  // 警告信息显示, to 显示在那个 DOM 前 (可以用 css selector)
  alert(msg, to) {
    $(".alert").remove();
    const html = `<div class='alert alert-warning'><button class='close' data-dismiss='alert'><span aria-hidden='true'>&times;</span></button>${msg}</div>`;
    if (to) {
      return $(to).before(html);
    } else {
      return $("#main").prepend(html);
    }
  },

  // 成功信息显示, to 显示在那个 DOM 前 (可以用 css selector)
  notice(msg, to) {
    $(".alert").remove();
    const html = `<div class='alert alert-success'><button class='close' data-dismiss='alert'><span aria-hidden='true'>&times;</span></button>${msg}</div>`;
    if (to) {
      return $(to).before(html);
    } else {
      return $("#main").prepend(html);
    }
  },

  openUrl(url) {
    return window.open(url);
  },

  // Use this method to redirect so that it can be stubbed in test
  gotoUrl(url) {
    return Turbolinks.visit(url);
  },

  // scan logins in jQuery collection and returns as a object,
  // which key is login, and value is the name.
  scanMentionableLogins(query) {
    const result = [];
    const logins = [];
    for (let e of Array.from(query)) {
      const $e = $(e);
      const item = {
        login: $e.find(".user-name").first().text(),
        name: $e.find(".user-name").first().attr('data-name'),
        avatar_url: $e.find(".avatar img").first().attr("src")
      };

      if (!item.login) { continue; }
      if (!item.name) { continue; }
      if (logins.indexOf(item.login) !== -1) { continue; }

      logins.push(item.login);
      result.push(item);
    }

    console.log(result);
    return _.uniq(result);
  },

  mentionable(el, logins) {
    if (!logins) { logins = []; }
    $(el).atwho({
      at: "@",
      limit: 8,
      searchKey: 'login',
      callbacks: {
        filter(query, data, searchKey) {
          return data;
        },
        sorter(query, items, searchKey) {
          return items;
        },
        remoteFilter(query, callback) {
          const r = new RegExp(`^${query}`);
          // 过滤出本地匹配的数据
          const localMatches = _.filter(logins, u => r.test(u.login) || r.test(u.name));
          // Remote 匹配
          return $.getJSON('/search/users.json', { q: query }, function (data) {
            // 本地的排前面
            for (let u of Array.from(localMatches)) {
              data.unshift(u);
            }
            // 去重复
            data = _.uniq(data, false, item => item.login);
            // 限制数量
            data = _.first(data, 8);
            return callback(data);
          });
        }
      },
      displayTpl: "<li data-value='${login}'><img src='${avatar_url}' height='20' width='20'/> ${login} <small>${name}</small></li>",
      insertTpl: "@${login}"
    }).atwho({
      at: ":",
      limit: 8,
      searchKey: 'code',
      data: window.EMOJI_LIST,
      displayTpl: `<li data-value='\${code}'><img src='${App.twemoji_url}/svg/\${url}.svg' class='twemoji' /> \${code} </li>`,
      insertTpl: "${code}"
    });
    return true;
  }
};


document.addEventListener('turbolinks:load', () => window._appView = new AppView());

document.addEventListener('turbolinks:click', function (event) {
  if (event.target.getAttribute('href').charAt(0) === '#') {
    return event.preventDefault();
  }
});

FormStorage.init();
