import React from 'react';
import { Users, Building, Search, CheckCircle } from 'lucide-react';
import Footer from '../components/layout/Footer';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-full">
              <Building className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            About G8Road: Your Camp Management Co-Pilot & Burner Connection Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            The all-in-one platform built specifically for the Burning Man community
          </p>
        </div>

        {/* What is G8Road Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
              <Search className="w-8 h-8 mr-3 text-orange-500" />
              What is G8Road?
            </h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                G8Road is the all-in-one platform built specifically for the Burning Man community. 
                We handle everything from the organizer's side—managing camp rosters, coordinating shifts, 
                and planning logistics—but we are <strong className="text-orange-600">ALSO</strong> the central hub 
                for people looking for camps to join, for experiences to enjoy, and for connecting with 
                the larger burner community.
              </p>
            </div>
          </div>
        </section>

        {/* Who Is It For Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
              <Users className="w-8 h-8 mr-3 text-orange-500" />
              Who Is It For?
            </h2>
            
            {/* Camp Leads & Organizers */}
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="w-6 h-6 mr-2 text-orange-500" />
                Camp Leads & Organizers
              </h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                To <strong className="text-orange-600">conquer the chaos</strong> of camp operations. 
                Say goodbye to the Frankenstein stack of tools! G8Road removes the <strong className="text-orange-600">endless struggle</strong> 
                of juggling separate <strong className="text-orange-600">Google Forms, Docs, and Spreadsheets</strong>. 
                It eliminates the repetitive <strong className="text-orange-600">copy-and-paste</strong> data entry and merging 
                different sources, bringing <strong className="text-orange-600">every operational aspect</strong> 
                (from member application status to task management and shift sign-ups) 
                <strong className="text-orange-600"> seamlessly into one, unified place.</strong>
              </p>
              
              {/* AI VISUAL REFERENCE A: Camp Roster Mockup */}
              <div className="bg-gray-100 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Camp Roster Management</h4>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h5 className="font-medium text-gray-700">Mudskippers Camp - Member Roster (25 Members)</h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dues Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          { name: "Alex Johnson", status: "Confirmed", dues: "✓", role: "Lead" },
                          { name: "Sarah Chen", status: "Confirmed", dues: "✓", role: "Co-Lead" },
                          { name: "Mike Rodriguez", status: "Pending", dues: "⏳", role: "Member" },
                          { name: "Emma Wilson", status: "Confirmed", dues: "✓", role: "Volunteer" },
                          { name: "David Kim", status: "Waitlist", dues: "❌", role: "Member" },
                          { name: "Lisa Brown", status: "Confirmed", dues: "✓", role: "Member" },
                          { name: "Tom Anderson", status: "Pending", dues: "⏳", role: "Member" },
                          { name: "Maria Garcia", status: "Confirmed", dues: "✓", role: "Volunteer" },
                          { name: "James Taylor", status: "Confirmed", dues: "✓", role: "Member" },
                          { name: "Anna Lee", status: "Pending", dues: "⏳", role: "Member" }
                        ].map((member, index) => (
                          <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-4 py-3 text-sm text-gray-900">{member.name}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                member.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                member.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{member.dues}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{member.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500">
                    Showing 10 of 25 members • All data synced in real-time
                  </div>
                </div>
              </div>
            </div>

            {/* Burners & Participants */}
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2 text-orange-500" />
                Burners & Participants
              </h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                To easily <strong className="text-orange-600">find and apply to theme camps</strong>, 
                discover events, and connect with fellow burners.
              </p>
              
              {/* AI VISUAL REFERENCE B: Camp Discovery Mockup */}
              <div className="bg-gray-100 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Camp Discovery</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "Mudskippers", description: "Interactive art and music", members: "25", status: "Open" },
                    { name: "Sunrise Kitchen", description: "Morning coffee and community", members: "15", status: "Open" },
                    { name: "Fire Spinners", description: "Performance and workshops", members: "30", status: "Waitlist" },
                    { name: "Temple Guardians", description: "Sacred space and meditation", members: "20", status: "Open" },
                    { name: "Dusty Rhythms", description: "Live music and dancing", members: "40", status: "Open" },
                    { name: "Playa Provisions", description: "Food and beverage service", members: "35", status: "Open" }
                  ].map((camp, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-sm p-4 border">
                      <div className="h-32 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg mb-3 flex items-center justify-center">
                        <Building className="w-8 h-8 text-white" />
                      </div>
                      <h5 className="font-semibold text-gray-900 mb-1">{camp.name}</h5>
                      <p className="text-sm text-gray-600 mb-2">{camp.description}</p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{camp.members} members</span>
                        <span className={`px-2 py-1 rounded-full ${
                          camp.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <button className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                    View All Camps
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl shadow-xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-6 flex items-center">
              <Building className="w-8 h-8 mr-3" />
              Our Story
            </h2>
            <div className="prose prose-lg prose-invert max-w-none">
              <p className="leading-relaxed mb-6">
                G8Road was created <strong>by</strong> Camp Leads, <strong>for</strong> Camp Leads. 
                Like many of you, we were exhausted by the <strong>endless back-and-forth</strong> between siloed tools. 
                We yearned for a <strong>one-stop-shop</strong> solution, but no existing CRM or project management 
                tool truly understood the unique, complex, and beautiful chaos of running a camp at Black Rock City. 
                So, we built the tool we always needed. G8Road is the solution born from that necessity.
              </p>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Why Choose G8Road?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: <CheckCircle className="w-8 h-8 text-green-500" />,
                  title: "Unified Platform",
                  description: "Everything in one place - no more juggling multiple tools"
                },
                {
                  icon: <Building className="w-8 h-8 text-orange-500" />,
                  title: "Built for Burners",
                  description: "Designed specifically for the Burning Man community"
                },
                {
                  icon: <Users className="w-8 h-8 text-blue-500" />,
                  title: "Real-time Collaboration",
                  description: "Keep your entire camp connected and informed"
                },
                {
                  icon: <Search className="w-8 h-8 text-purple-500" />,
                  title: "Easy Discovery",
                  description: "Find camps and connect with fellow burners"
                },
                {
                  icon: <Building className="w-8 h-8 text-red-500" />,
                  title: "Camp Management",
                  description: "Streamline rosters, shifts, and logistics"
                },
                {
                  icon: <Search className="w-8 h-8 text-indigo-500" />,
                  title: "Simple Onboarding",
                  description: "Get started quickly with intuitive design"
                }
              ].map((feature, index) => (
                <div key={index} className="text-center p-6 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Camp Management?
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join the growing community of camp leads who have simplified their operations with G8Road.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/register"
                className="inline-flex items-center px-8 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Get Started Free
                →
              </a>
              <a
                href="/camps"
                className="inline-flex items-center px-8 py-3 border-2 border-orange-500 text-orange-500 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
              >
                Explore Camps
              </a>
            </div>
          </div>
        </section>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default About;
