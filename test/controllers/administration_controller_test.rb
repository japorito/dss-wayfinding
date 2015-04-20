require 'test_helper'

class AdministrationControllerTest < ActionController::TestCase
  # test "the truth" do
  #   assert true
  # end
  #

  test "public can modify start location" do
    post :start, { :location => '1100' }

    assert_redirected_to root_path
  end

  test "public cannot modify departments" do
    post :department_location, { :format => 'json', :department_room_number => '1100', :department_id => 113629430 }

    assert_response 401
  end

  test "superadmins can modify origin" do
    superadminify

    post :origin, { :format => 'json', :origin => '1100' },
      { :auth_via => 'cas', :user_id => 980190962 }
    
    assert_response :success
  end

  test "directoryadmins cannot modify origin" do
    directoryadminify

    post :origin, { :format => 'json', :origin => '1100' },
      { :auth_via => 'cas', :user_id => 980190962 }
    
    assert_response 403
  end

  test "directoryadmins cannot see unmatched logs, search logs, and unroutable logs" do
    directoryadminify

    get :unmatched, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response 403

    get :unroutable, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response 403

    get :search_terms, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response 403
  end

  test "superadmins can see unmatched logs, search logs, and unroutable logs" do
    superadminify

    get :unmatched, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response :success

    get :unroutable, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response :success

    get :search_terms, { :format => 'json'}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_response :success
  end

  test "directoryadmins cannot upload csv and svg" do
    directoryadminify

    post :map_upload, {}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_redirected_to(action: "access_denied", :controller => "site")

    post :csv, {}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_redirected_to(action: "access_denied", :controller => "site")
  end

  test "superadmins can upload csv and svg" do
    superadminify

    post :map_upload, {}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_redirected_to(action: "index", error: "Error uploading SVG map")

    post :csv, {}, { :auth_via => 'cas', :user_id => 980190962 }
    assert_redirected_to(action: "index", error: "Error uploading file")
  end
end
