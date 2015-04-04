class DirectoryObjectsController < ApplicationController
  before_action :set_origin
  skip_before_filter :require_login
  skip_before_filter :authenticate

  respond_to :html, :json

  # GET /directory_objects
  def index
    @type = params[:type]

    if params[:type] == "Person"
      @directory_objects = Person.all.order(:last)
      @scrubber_categories = ("A".."Z").to_a
    elsif params[:type] == "Department"
      @directory_objects = Department.all.order(:title)
      @scrubber_categories = ("A".."Z").to_a
    elsif params[:type] == "Event"
      @directory_objects = Event.all.order(:title)
      @scrubber_categories = []
    elsif params[:type] == "Room"
      @directory_objects = Room.all.order(:room_number)
      @scrubber_categories = ['L',1,2,3,4,5]
    else
      # Unsupported behavior
      @directory_objects = []
      @scrubber_categories = []
    end

    @directory_objects = @directory_objects.uniq
  end

  def create
    type = params[:type].singularize.capitalize

    case type
    when 'Person'
      @object = Person.new
    when 'Department'
      @object = Department.new
    end

    if !@object.present?
      respond_to do |format|
        format.json {render json: { message: "Error identifying type of object" }, status: 405 }
      end
    end

    if type == 'Person' && (params[:first].blank? || params[:last].blank?)
        respond_to do |format|
            format.json {render json: { message: "Error: both first and last names must be supplied" }, status: 405}
        end
    end

    @object.first = params[:first] unless params[:first].blank?
    @object.last = params[:last] unless params[:last].blank?
    @object.email = params[:email] unless params[:email].blank?
    @object.phone = params[:phone] unless params[:phone].blank?
    @object.room_number = params[:room_number] unless params[:room_number].blank?
    @object.name = params[:name] unless params[:name].blank?
    @object.title = params[:title] unless params[:title].blank?
    @object.department = Department.find(params[:department]) unless params[:department].blank?

    if type == 'Person'
      @object.rooms = []
      params[:rooms].each do |room|
        @object.rooms << Room.find(room)
      end unless params[:rooms].blank?
    end
    if type == 'Department'
      @object.room = Room.find_by(room_number: params[:room].rjust(4,'0')) unless params[:room].blank?
    end

    if @object.save
      respond_to do |format|
        format.json { render json: @object }
      end
    else
      respond_to do |format|
        format.json {render json: { message: "Error Creating " + type + ".. Duplicate?" }, status: 405 }
      end
    end
  end

  def update
    # Find existing object
    @object = DirectoryObject.find_by(id: params[:id])
    type = params[:type].singularize.capitalize

    if @object.present?
      @object.first = params[:first] unless params[:first].blank?
      @object.last = params[:last] unless params[:last].blank?
      @object.email = params[:email] unless params[:email].blank?
      @object.phone = params[:phone] unless params[:phone].blank?
      @object.room_number = params[:room_number] unless params[:room_number].blank?
      @object.name = params[:name] unless params[:name].blank?
      @object.title = params[:title] unless params[:title].blank?
      @object.department = Department.find(params[:department]) unless params[:department].blank?
      if type == 'Person'
        @object.rooms = []
        params[:rooms].each do |room|
          @object.rooms << Room.find(room)
        end unless params[:rooms].blank?
      end
      if type == 'Department'
        @object.room = Room.find_by(room_number: params[:room].rjust(4,'0')) unless params[:room].blank?
      end

      if @object.save
          respond_to do |format|
            format.json { render :json => @object }
          end
      else
          respond_to do |format|
              format.json { render json: { message: "Error updating " + type + "." }, status: 405 }
          end
      end 

    else

      respond_to do |format|
        format.json {render json: { message: "Error finding directory object" }, status: 405 }
      end

    end
  end

  def destroy
    if params[:id].present?
      # Find existing object
      @object = DirectoryObject.find(params[:id])
    end
    if @object.present? and @object.type != 'Room'
      @object.destroy
      respond_to do |format|
        format.json {render json: { message: "Object deleted successfully", id: @object.id }, status: 302 }
      end
    else
      respond_to do |format|
        format.json {render json: { message: "Error deleting directory object" }, status: 405 }
      end
    end
  end

  # POST /directory/search
  def search
    if params[:q] && params[:q].length > 0
      @query = params[:q]
      objects = DirectoryObject.arel_table

      query_objs = params[:q].split(/\s+/).map { |q|
        "%#{q}%"
      }
      query_objs.push("%#{params[:q]}%")

      query = query_objs.reduce("") { |qry,obj|
        if ! qry.is_a?(Arel::Nodes::Grouping)
            new_qry = objects[:first].matches(obj)
        else
            new_qry = qry.or(objects[:first].matches(obj))
        end

        new_qry.or(objects[:last].matches(obj))
           .or(objects[:title].matches(obj))
           .or(objects[:email].matches(obj))
           .or(objects[:name].matches(obj))
           .or(objects[:room_number].matches(obj))
      }

      @directory_objects = DirectoryObject.where(query)

      @directory_objects = @directory_objects.uniq

      # Remove special characters
      clean_query = params[:q].downcase.gsub(/[^0-9A-Za-z\s]/, '')

      terms_list = clean_query.strip.split(/\s+/)

      terms_list.each do |term|
        term_log = SearchTermLog.where(term: term).first_or_create
        term_log.count = term_log.count + 1
        term_log.save
      end

      # No results were found, log the query
      if @directory_objects.first == nil
        UnmatchedQueryLog.where(query: clean_query).first_or_create
      end

      respond_to do |format|
        format.json
        format.html
      end
    end
  end

  # GET /directory_objects/1
  # GET /room/1
  # GET /start/R0070/end/R2169
  # GET /start/R0070/directory/1234
  def show
    @directory_object = DirectoryObject.where(room_number: params[:number]).first if params[:number]
    @directory_object = DirectoryObject.find(params[:id]) if params[:id] && @directory_object.nil?

    respond_with @directory_object
  end

  private

  #
  # room
  #
  #     Normalizes input for room numbers
  #

  def normalize_room(number)
    return nil if number.nil?
    number.slice!(0) if number[0].upcase == "R"
    return number.to_s.rjust(4, '0').prepend("R")
  end

  #
  # set_origin
  #
  #     Called before ev'rything else. Sets @origin and @dest for views, if
  #     applicable.
  #
  
  def set_origin
    # Prefer url-specified start locations over set ones when the URL is of
    # format /start/.../end/...
    @origin = normalize_room(params[:start_loc]) ||
               cookies[:origin] || cookies[:start_location]
    @dest = normalize_room(params[:end_loc])

    unless @origin
      logger.error "An instance of Wayfinding had a page loaded without an origin set. IP: #{request.remote_ip}"
    end
  end

  # Never trust parameters from the scary internet, only allow the white list through.
  def directory_object_params
    params.require(:directory_object).permit(:title, :time, :link, :first, :last, :email, :phone, :name, :room_number, :is_bathroom, :rss_feed, :type, :room_id)
  end
end
