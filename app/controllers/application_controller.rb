# frozen_string_literal: true

# ApplicationController
class ApplicationController < ActionController::Base
  protect_from_forgery prepend: true
  helper_method :turbolinks_app?, :turbolinks_ios?, :turbolinks_app_version
  around_action :set_time_zone

  include SetCurrentInfo
  include Homeland::UserNotificationHelper

  # Addition contents for etag
  etag { current_user.try(:id) }
  etag { unread_notify_count }
  etag { flash }
  etag { Setting.navbar_html }
  etag { Setting.footer_html }
  etag { Rails.env.development? ? Time.now : Date.current }

  rescue_from ActiveRecord::RecordNotFound do |exception|
    respond_to do |format|
      format.json { head :not_found }
      format.html { render "/errors/404", status: :not_found }
    end
  end

  before_action do
    resource = controller_name.singularize.to_sym
    method = "#{resource}_params"
    params[resource] &&= send(method) if respond_to?(method, true)

    if devise_controller?
      devise_parameter_sanitizer.permit(:sign_up, keys: %i[login email email_public name password password_confirmation _rucaptcha])
      devise_parameter_sanitizer.permit(:sign_in, keys: %i[login password remember_me])
      devise_parameter_sanitizer.permit(:account_update) do |u|
        if current_user.email_locked?
          u.permit(*User::ACCESSABLE_ATTRS)
        else
          u.permit(:email, *User::ACCESSABLE_ATTRS)
        end
      end
    end

    cookies.signed[:user_id] ||= current_user.try(:id)

    # hit unread_notify_count
    unread_notify_count
  end

  before_action :set_active_menu
  def set_active_menu
    @current = case controller_name
               when "pages"
                 ["/wiki"]
               else
                 ["/#{controller_name}"]
    end
  end

  before_action :set_locale
  def set_locale
    I18n.locale = user_locale

    # after store current locale
    cookies[:locale] = params[:locale] if params[:locale]
  rescue I18n::InvalidLocale
    I18n.locale = I18n.default_locale
  end

  def render_404
    render_optional_error_file(404)
  end

  def render_403
    render_optional_error_file(403)
  end

  def render_optional_error_file(status_code)
    status = status_code.to_s
    fname = %w[404 403 422 500].include?(status) ? status : "unknown"

    respond_to do |format|
      format.html { render template: "/errors/#{fname}", handler: [:erb], status: status, layout: "application" }
      format.all { render body: nil, status: status }
    end
  end

  rescue_from CanCan::AccessDenied do |_exception|
    redirect_to main_app.root_path, alert: t("common.access_denied")
  end

  def store_location
    session[:return_to] = request.url
  end

  def redirect_back_or_default(default)
    redirect_to(session[:return_to] || default)
    session[:return_to] = nil
  end

  def redirect_referrer_or_default(default)
    redirect_to(request.referrer || default)
  end

  def authenticate_user!(opts = {})
    return if current_user
    if turbolinks_app?
      render plain: "401 Unauthorized", status: 401
      return
    end

    store_location

    super(opts)
  end

  def current_user
    if doorkeeper_token
      return @current_user if defined? @current_user
      @current_user ||= User.find_by_id(doorkeeper_token.resource_owner_id)
      sign_in @current_user
      @current_user
    else
      super
    end
  end

  def turbolinks_app?
    @turbolinks_app ||= request.user_agent.to_s.include?("turbolinks-app")
  end

  def turbolinks_ios?
    @turbolinks_ios ||= turbolinks_app? && request.user_agent.to_s.include?("iOS")
  end

  # read turbolinks app version
  # example: version:2.1
  def turbolinks_app_version
    return "" unless turbolinks_app?
    return @turbolinks_app_version if defined? @turbolinks_app_version
    version_str = request.user_agent.to_s.match(/version:[\d\.]+/).to_s
    @turbolinks_app_version = version_str.split(":").last
    @turbolinks_app_version
  end

  # Require Setting enabled module, else will render 404 page.
  def self.require_module_enabled!(name)
    before_action do
      unless Setting.has_module?(name)
        render_404
      end
    end
  end

  def require_no_sso!
    redirect_to auth_sso_path if Setting.sso_enabled?
  end

  private

    def set_time_zone(&block)
      tz = Setting.timezone
      ActiveSupport::TimeZone.find_tzinfo(tz) rescue tz = "UTC"
      Time.use_zone(tz, &block)
    end

    def user_locale
      params[:locale] || cookies[:locale] || http_head_locale || Setting.default_locale || I18n.default_locale
    end

    def http_head_locale
      return nil if !Setting.auto_locale?
      http_accept_language.language_region_compatible_from(I18n.available_locales)
    end
end
