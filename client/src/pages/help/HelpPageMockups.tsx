import React from 'react';
import { Card, Button, Input } from '../../components/ui';
import { Book, LayoutDashboard, Users, MessageCircle, Search } from 'lucide-react';

type FaqItem = {
  question: string;
  answer: string;
};

type CategoryBlock = {
  name: string;
  faqs: FaqItem[];
};

const SAMPLE_CATEGORIES: CategoryBlock[] = [
  {
    name: 'Camp Management',
    faqs: [
      {
        question: 'How do I add members to my camp?',
        answer:
          'Go to Roster, choose Add Member, and save. You can also import CSV to add multiple roster members in one step.'
      },
      {
        question: 'Can I edit my camp profile after creating it?',
        answer:
          'Yes. Open Your Camp and update profile fields. Changes save immediately and update your public camp profile.'
      }
    ]
  },
  {
    name: 'Applications',
    faqs: [
      {
        question: 'How long does it take to hear back from camps?',
        answer:
          'Most camps respond in a few days to a week. You can follow up or apply to additional camps while waiting.'
      }
    ]
  },
  {
    name: 'Technical Support',
    faqs: [
      {
        question: 'What if I forget my password?',
        answer:
          'Use Forgot Password on the login page. We send a reset link to your account email.'
      }
    ]
  }
];

const categoryPillClass =
  'px-3 py-1 rounded-full text-xs font-semibold border border-green-200 bg-green-50 text-green-700';

const HelpPageMockups: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <div className="text-center">
        <h1 className="text-h1 font-lato-bold text-custom-text mb-2">Help Page Redesign Mockups</h1>
        <p className="text-custom-text-secondary">
          3 layout options with category grouping and always-visible answers (no collapsing).
        </p>
      </div>

      {/* Option 1 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-green-600" />
            <h2 className="text-h2 font-lato-bold text-custom-text">Option 1 - Category Dashboard</h2>
          </div>
          <Button variant="outline">Choose Option 1</Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5">
            <h3 className="text-xl font-lato-bold text-custom-text">Help & Support</h3>
            <p className="text-sm text-custom-text-secondary">Browse answers by category and contact support.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
            <aside className="lg:col-span-3 border-r border-gray-200 p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Categories</p>
              <div className="space-y-2">
                {SAMPLE_CATEGORIES.map((category, index) => (
                  <div
                    key={`opt1-nav-${category.name}`}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      index === 0
                        ? 'bg-green-100 text-green-800 font-semibold'
                        : 'bg-white text-custom-text border border-gray-200'
                    }`}
                  >
                    {category.name}
                  </div>
                ))}
              </div>
            </aside>

            <div className="lg:col-span-6 p-4">
              <div className="grid grid-cols-1 gap-3">
                {SAMPLE_CATEGORIES[0].faqs.map((faq) => (
                  <Card key={`opt1-faq-${faq.question}`} className="bg-white border border-gray-200">
                    <p className="text-sm font-semibold text-custom-text mb-2">{faq.question}</p>
                    <p className="text-sm text-custom-text-secondary leading-relaxed">{faq.answer}</p>
                  </Card>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-3 border-l border-gray-200 p-4 bg-gray-50">
              <Card className="bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-custom-text">Contact Support</p>
                </div>
                <p className="text-xs text-custom-text-secondary">
                  Can’t find an answer? Send support a message.
                </p>
                <Button variant="primary" className="mt-3 w-full">
                  Send Message
                </Button>
              </Card>
            </aside>
          </div>
        </Card>
      </section>

      {/* Option 2 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <h2 className="text-h2 font-lato-bold text-custom-text">Option 2 - Knowledge Base Sections</h2>
          </div>
          <Button variant="outline">Choose Option 2</Button>
        </div>

        <Card className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-lato-bold text-custom-text">Help & Support</h3>
            <p className="text-sm text-custom-text-secondary">Find answers fast with category sections.</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <Input className="pl-10" placeholder="Search questions..." />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {SAMPLE_CATEGORIES.map((category, index) => (
              <div
                key={`opt2-category-${category.name}`}
                className={`rounded-xl border p-4 ${
                  index % 2 === 0 ? 'bg-green-50/60 border-green-100' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={categoryPillClass}>{category.name}</span>
                </div>
                <div className="space-y-3">
                  {category.faqs.map((faq) => (
                    <div key={`opt2-faq-${faq.question}`} className="rounded-lg bg-white border border-gray-200 p-3">
                      <p className="text-sm font-semibold text-custom-text mb-1">{faq.question}</p>
                      <p className="text-sm text-custom-text-secondary">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Option 3 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-green-600" />
            <h2 className="text-h2 font-lato-bold text-custom-text">Option 3 - Magazine Category Cards</h2>
          </div>
          <Button variant="outline">Choose Option 3</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SAMPLE_CATEGORIES.map((category, idx) => (
            <Card
              key={`opt3-category-${category.name}`}
              className={`relative overflow-hidden border ${
                idx === 0 ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={categoryPillClass}>{category.name}</span>
                <span className="text-[11px] text-gray-500">Updated today</span>
              </div>
              <div className="space-y-3">
                {category.faqs.map((faq) => (
                  <div key={`opt3-faq-${faq.question}`} className="rounded-lg border border-white/70 bg-white/80 p-3">
                    <p className="text-sm font-semibold text-custom-text mb-1">{faq.question}</p>
                    <p className="text-sm text-custom-text-secondary">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HelpPageMockups;
