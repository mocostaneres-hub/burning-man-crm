import React from 'react';
import { Users, Shield, AlertTriangle, Mail } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-xl text-gray-600">
            Last updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-600" />
              Agreement to Terms
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to G8Road CRM. These Terms of Service ("Terms") govern your use of our platform 
              that connects Burning Man participants with theme camps and facilitates camp management. 
              By accessing or using our service, you agree to be bound by these Terms.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-6 h-6 mr-2 text-blue-600" />
              Service Description
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              G8Road CRM provides a platform for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Connecting burners with theme camps</li>
              <li>Managing camp rosters and member information</li>
              <li>Coordinating volunteer shifts and tasks</li>
              <li>Organizing camp events and activities</li>
              <li>Facilitating communication within the Burning Man community</li>
            </ul>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Accounts</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Account Creation</h3>
                <p className="text-gray-700 leading-relaxed">
                  You must provide accurate and complete information when creating an account. 
                  You are responsible for maintaining the confidentiality of your account credentials.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Account Types</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li><strong>Personal Accounts:</strong> For individual burners seeking camp connections</li>
                  <li><strong>Camp Accounts:</strong> For theme camps managing rosters and activities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-600" />
              Acceptable Use
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">You agree to use our platform only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Transmit harmful or malicious code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the platform for commercial purposes without permission</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Post false, misleading, or defamatory content</li>
              <li>Spam or send unsolicited communications</li>
            </ul>
          </section>

          {/* Content and Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Content and Intellectual Property</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Your Content</h3>
                <p className="text-gray-700 leading-relaxed">
                  You retain ownership of content you post on our platform. By posting content, 
                  you grant us a license to use, display, and distribute it in connection with our services.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Our Content</h3>
                <p className="text-gray-700 leading-relaxed">
                  The platform, including its design, functionality, and content, is owned by G8Road CRM 
                  and protected by intellectual property laws.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Your privacy is important to us. Please review our Privacy Policy, which explains 
              how we collect, use, and protect your information.
            </p>
          </section>

          {/* Prohibited Activities */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-2 text-red-600" />
              Prohibited Activities
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">The following activities are strictly prohibited:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Creating fake accounts or impersonating others</li>
              <li>Sharing personal information of other users without consent</li>
              <li>Using the platform for illegal activities</li>
              <li>Attempting to reverse engineer or hack our systems</li>
              <li>Distributing malware or harmful software</li>
              <li>Violating Burning Man's principles or community guidelines</li>
            </ul>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may terminate or suspend your account at any time for violation of these Terms. 
              You may also terminate your account at any time by contacting us.
            </p>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Disclaimers</h2>
            <p className="text-gray-700 leading-relaxed">
              Our platform is provided "as is" without warranties of any kind. We do not guarantee 
              the accuracy, completeness, or reliability of any content or information on our platform.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, G8Road CRM shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages resulting from your use of our platform.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify and hold harmless G8Road CRM from any claims, damages, or expenses 
              arising from your use of our platform or violation of these Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the State of California, without regard to 
              conflict of law principles.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these Terms from time to time. We will notify users of significant changes 
              by posting the updated Terms on our platform.
            </p>
          </section>

          {/* Burning Man Community Guidelines */}
          <section className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Burning Man Community Guidelines</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              As a platform serving the Burning Man community, we expect all users to uphold the 
              principles of:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Radical Inclusion:</strong> Welcome and respect all participants</li>
              <li><strong>Gifting:</strong> Give without expectation of return</li>
              <li><strong>Decommodification:</strong> Resist commercial exploitation</li>
              <li><strong>Radical Self-reliance:</strong> Rely on inner resources</li>
              <li><strong>Radical Self-expression:</strong> Express yourself authentically</li>
              <li><strong>Communal Effort:</strong> Collaborate and cooperate</li>
              <li><strong>Civic Responsibility:</strong> Act responsibly in community</li>
              <li><strong>Leaving No Trace:</strong> Respect the environment</li>
              <li><strong>Participation:</strong> Engage actively and meaningfully</li>
              <li><strong>Immediacy:</strong> Experience the present moment</li>
            </ul>
          </section>

          {/* Contact Information */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-6 h-6 mr-2 text-blue-600" />
              Contact Us
            </h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-gray-700">
                <strong>Email:</strong> legal@g8road.com
              </p>
              <p className="text-gray-700">
                <strong>General Support:</strong> info@g8road.com
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
