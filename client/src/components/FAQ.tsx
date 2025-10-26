import React, { useState, useEffect } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

interface FAQItem {
  question: string;
  answer: string;
}

const campFAQData: FAQItem[] = [
  {
    question: "What is this platform?",
    answer: "This is a comprehensive platform designed specifically for G8Road camps to manage their rosters, recruit members, organize volunteer shifts, handle EAP assignments, and build their community. It's built by burners, for burners."
  },
  {
    question: "How is this different from other camp management tools?",
    answer: "Our platform is specifically designed for G8Road camps with features like EAP assignments, orientation calls, mapping tools, and shopping lists. We understand the unique needs of burner communities and have built features that address real camp management challenges."
  },
  {
    question: "Can I use this for both personal and camp accounts?",
    answer: "Yes! You can create either a personal account (to join camps as a member) or a camp account (to manage your camp). Each email address can only be used for one account type to maintain clear separation between personal and camp management."
  },
  {
    question: "What are the different account types and roles?",
    answer: "We have two account types: Personal (for individual burners) and Camp (for camp management). Within camps, there are three roles: Camp Lead (full administrative access), Project Lead (manages specific projects and team members), and Camp Member (basic access with ability to request role changes)."
  },
  {
    question: "How do I sign up with Google or Apple?",
    answer: "OAuth sign-in is available for personal accounts only. When you select 'Personal Account' during registration, you'll see Google and Apple sign-in buttons. This allows for quick registration using your existing accounts while maintaining security."
  },
  {
    question: "What features are available for camp management?",
    answer: "Camp accounts have access to member roster management, role assignments, volunteer shift scheduling, EAP (Emergency Action Plan) assignments, orientation call scheduling, camp mapping tools, collaborative shopping lists, video meetings, and comprehensive analytics."
  },
  {
    question: "How do volunteer shifts work?",
    answer: "Camp leads can create volunteer shifts for various camp activities (setup, teardown, kitchen duty, etc.). Members can sign up for shifts, and the system tracks participation. This helps ensure fair distribution of camp responsibilities."
  },
  {
    question: "What are EAP assignments?",
    answer: "EAP (Emergency Action Plan) assignments help camps prepare for emergencies by assigning specific roles and responsibilities to members. This includes first aid responders, evacuation coordinators, communication leads, and other critical roles."
  },
  {
    question: "Can I schedule orientation calls for new members?",
    answer: "Yes! Camp leads can schedule orientation calls to onboard new members. The system integrates with video calling platforms to help new members understand camp culture, rules, and expectations before the event."
  },
  {
    question: "How does the mapping feature work?",
    answer: "The mapping feature allows camps to create and share their camp layout, including tent locations, common areas, kitchen setup, and other important landmarks. This helps members navigate the camp and plan their setup."
  },
  {
    question: "Are shopping lists collaborative?",
    answer: "Yes! Camp members can contribute to shared shopping lists for camp supplies, food, equipment, and other necessities. The system tracks who's bringing what to avoid duplication and ensure nothing is forgotten."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use industry-standard security practices including encrypted data transmission, secure authentication, and regular security audits. Your camp's sensitive information is protected and only accessible to authorized members."
  },
  {
    question: "Can I export my camp data?",
    answer: "Yes, camp leads can export member rosters, shift schedules, and other camp data in various formats (CSV, PDF) for backup purposes or to use with other tools."
  },
  {
    question: "What if I need help or have questions?",
    answer: "We have a comprehensive help system, and our support team is made up of experienced burners who understand camp management challenges. You can reach out through the platform or email us directly."
  },
  {
    question: "Is there a mobile app?",
    answer: "The platform is fully responsive and works great on mobile devices. We're also planning dedicated mobile apps for iOS and Android to provide an even better mobile experience for camp management on the go."
  }
];

const memberFAQData: FAQItem[] = [
  {
    question: "What is this platform?",
    answer: "This is a community platform designed to help you find and connect with G8Road camps, discover events and experiences, and build lasting relationships within the burner community."
  },
  {
    question: "How do I find camps to join?",
    answer: "Browse our camp directory to discover amazing camps that match your interests, values, and G8Road goals. Each camp profile shows their mission, activities, requirements, and what they're looking for in members."
  },
  {
    question: "How do I apply to join a camp?",
    answer: "Once you find a camp you're interested in, you can apply directly through the platform. Share your skills, interests, and what you can contribute to make your application stand out to camp leaders."
  },
  {
    question: "What information should I include in my application?",
    answer: "Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you're hoping to get out of joining the camp. Include any relevant experience with art, cooking, construction, or other valuable skills."
  },
  {
    question: "How long does it take to hear back from camps?",
    answer: "Response times vary by camp, but most camps try to respond within a few days to a week. If you don't hear back, you can send a follow-up message or apply to other camps that interest you."
  },
  {
    question: "Can I apply to multiple camps?",
    answer: "Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you're accepted by multiple and need to make a decision."
  },
  {
    question: "How do I discover events and experiences?",
    answer: "Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests."
  },
  {
    question: "Can I message camps directly?",
    answer: "Yes! Our messaging system allows you to communicate directly with camp leaders to ask questions, learn more about their community, and discuss your potential fit with the camp."
  },
  {
    question: "What if I'm new to G8Road?",
    answer: "Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don't be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities."
  },
  {
    question: "How do I know if a camp is right for me?",
    answer: "Read their camp profile thoroughly, check out their social media, and ask questions about their values, activities, and expectations. Consider what you want to contribute and experience during your G8Road week."
  },
  {
    question: "Can I create my own events or workshops?",
    answer: "Yes! Once you're part of a camp, you can collaborate with your campmates to create and promote events, workshops, or art projects that you'd like to share with the community."
  },
  {
    question: "How do I stay updated on camp activities?",
    answer: "Use our messaging system and calendar features to stay connected with your camp. Camps often share updates about meetings, preparation activities, and event planning through the platform."
  },
  {
    question: "What if I need to change my plans?",
    answer: "Life happens! If your situation changes, communicate openly with your camp as soon as possible. Most camps understand that plans can change and will work with you to find solutions."
  },
  {
    question: "Is my personal information secure?",
    answer: "Absolutely. We use industry-standard security practices to protect your information. Your personal details are only shared with camps you choose to apply to, and you control what information is visible."
  },
  {
    question: "How do I get help if I have questions?",
    answer: "Use our help center and messaging system to get support. Our team is made up of experienced burners who understand the community and can help guide you through the process."
  }
];

const FAQ: React.FC = () => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | false>(false);
  const [faqData, setFaqData] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleToggle = (panel: string) => {
    setExpanded(expanded === panel ? false : panel);
  };

  useEffect(() => {
    const loadFAQs = async () => {
      try {
        setLoading(true);
        const response = await apiService.get('/help/faqs');
        setFaqData(response.faqs || []);
      } catch (error) {
        console.error('Error loading FAQs:', error);
        // Fallback to static data if API fails
        setFaqData(user?.accountType === 'camp' ? campFAQData : memberFAQData);
      } finally {
        setLoading(false);
      }
    };

    loadFAQs();
  }, [user?.accountType]);

  return (
    <div className="py-16 bg-custom-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-10 h-10 text-custom-primary mr-3" />
            <h2 className="text-h1 md:text-h1 font-lato-bold text-custom-primary">
              Frequently Asked Questions
            </h2>
          </div>
          <p className="text-h5 text-custom-text-secondary max-w-2xl mx-auto">
            {user?.accountType === 'camp' 
              ? 'Everything you need to know about managing your G8Road camp'
              : 'Everything you need to know about finding camps and your G8Road experience'
            }
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-custom-primary"></div>
              <p className="mt-2 text-custom-text-secondary">Loading FAQs...</p>
            </div>
          ) : (
            faqData.map((faq, index) => (
            <div
              key={index}
              className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                onClick={() => handleToggle(`panel${index}`)}
              >
                <h3 className="text-h4 font-lato-bold text-custom-text pr-4">
                  {faq.question}
                </h3>
                <ChevronDown 
                  className={`w-5 h-5 text-custom-primary transition-transform duration-200 ${
                    expanded === `panel${index}` ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expanded === `panel${index}` && (
                <div className="px-6 pb-4">
                  <p className="text-body text-custom-text-secondary leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))
          )}
        </div>

        <div className="text-center mt-12">
          <p className="text-body text-custom-text-secondary mb-2">
            Still have questions?
          </p>
          <p className="text-sm text-custom-text-secondary">
            Contact our support team or join our community discussions
          </p>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
