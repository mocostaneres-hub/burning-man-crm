import React from 'react';
import { Card } from '../components/ui';
import Footer from '../components/layout/Footer';
import { Book, AlertTriangle } from 'lucide-react';

const Principles: React.FC = () => {

  const principles = [
    {
      title: "Radical Inclusion",
      description: "Anyone may be a part of Burning Man. We welcome and respect the stranger. No prerequisites exist for participation in our community."
    },
    {
      title: "Gifting",
      description: "Burning Man is devoted to acts of gift giving. The value of a gift is unconditional. Gifting does not contemplate a return or an exchange for something of equal value."
    },
    {
      title: "Decommodification",
      description: "In order to preserve the spirit of gifting, our community seeks to create social environments that are unmediated by commercial sponsorships, transactions, or advertising. We stand ready to protect our culture from such exploitation. We resist the substitution of consumption for participatory experience."
    },
    {
      title: "Radical Self-reliance",
      description: "Burning Man encourages the individual to discover, exercise and rely on their inner resources."
    },
    {
      title: "Radical Self-expression",
      description: "Radical self-expression arises from the unique gifts of the individual. No one other than the individual or a collaborating group can determine its content. It is offered as a gift to others. In this spirit, the giver should respect the rights and liberties of the recipient."
    },
    {
      title: "Communal Effort",
      description: "Our community values creative cooperation and collaboration. We strive to produce, promote and protect social networks, public spaces, works of art, and methods of communication that support such interaction."
    },
    {
      title: "Civic Responsibility",
      description: "We value civil society. Community members who organize events should assume responsibility for public welfare and endeavor to communicate civic responsibilities to participants. They must also assume responsibility for conducting events in accordance with local, state and federal laws."
    },
    {
      title: "Leaving No Trace",
      description: "Our community respects the environment. We are committed to leaving no physical trace of our activities wherever we gather. We clean up after ourselves and endeavor, whenever possible, to leave such places in a better state than when we found them."
    },
    {
      title: "Participation",
      description: "Our community is committed to a radically participatory ethic. We believe that transformative change, whether in the individual or in society, can occur only through the medium of deeply personal participation. We achieve being through doing. Everyone is invited to work. Everyone is invited to play. We make the world real through actions that open the heart."
    },
    {
      title: "Immediacy",
      description: "Immediate experience is, in many ways, the most important touchstone of value in our culture. We seek to overcome barriers that stand between us and a recognition of our inner selves, the reality of those around us, participation in society, and contact with a natural world exceeding human powers. No idea can substitute for this experience."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <Book className="w-12 h-12 text-custom-primary mr-4" />
          <h1 className="text-h1 md:text-h1 font-lato-bold text-custom-primary">
            The 10 Principles of Burning Man
          </h1>
        </div>
        <p className="text-h5 text-custom-text-secondary max-w-4xl mx-auto mb-8">
          These principles were crafted not as a dictate of how people should be and act, but as a reflection of the community's ethos and culture as it has organically developed since the event's inception.
        </p>
        
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg max-w-4xl mx-auto mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-h4 font-lato-bold mb-2">
                Essential Reading for All Burners
              </h3>
              <p className="text-body text-yellow-800">
                Whether you're new to Burning Man or a returning burner, understanding and embodying these principles is fundamental to your experience. 
                These aren't just guidelines—they're the foundation of our community culture and essential for creating meaningful connections with camps and fellow burners.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Principles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {principles.map((principle, index) => (
          <Card 
            key={index}
            hover
            padding="lg"
            className="h-full transition-all duration-300 hover:shadow-lg hover:border-custom-primary"
          >
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-custom-primary flex items-center justify-center text-white text-sm font-bold mr-3 flex-shrink-0">
                {index + 1}
              </div>
              <h3 className="text-h4 font-lato-bold text-custom-primary">
                {principle.title}
              </h3>
            </div>
            <p className="text-body text-custom-text-secondary leading-relaxed">
              {principle.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Footer Information */}
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-h3 font-lato-bold text-custom-primary mb-4">
          Learn More About Burning Man
        </h3>
        <a 
          href="https://burningman.org/about/10-principles/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-custom-primary hover:text-green-700 font-medium transition-colors duration-200"
        >
          Read the official 10 Principles on Burning Man's website →
        </a>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Principles;
