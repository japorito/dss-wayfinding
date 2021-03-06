class Room < DirectoryObject
  validates :name, uniqueness: false, presence: false
  validates :room_number, uniqueness: true, presence: true
  validates :is_bathroom, uniqueness: false, presence: false

  has_and_belongs_to_many :people, join_table: 'person_room_join_requirements'

  has_many :events
  has_many :devices

  def as_json(options={})
    {
      :id => id,
      :room_number => room_number,
      :type => type,
      :name => name,
      :people => people.map do |person|
        {
          :name => person.name ? person.name : person.first + ' ' + person.last,
          :department => person.department ? person.department.title : '',
          :email => person.email ? person.email : '',
          :phone => person.phone ? person.phone : '',
          :office_hours => person.office_hours ? person.office_hours : ''
        }
      end
    }
  end
end
