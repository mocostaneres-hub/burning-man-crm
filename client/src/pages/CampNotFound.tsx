import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

const CampNotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-orange-100 rounded-full p-6">
            <div className="text-6xl">⚠️</div>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Camp Profile Not Found
        </h1>

        <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
          This camp profile either does not exist or the camp admin has not yet set it to public. 
          Please contact the camp admin directly and ask them to activate their profile.
        </p>

        {/* Discovery Link */}
        <div className="bg-white border-2 border-orange-200 rounded-lg p-8 mb-6 shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="text-5xl">🔍</div>
          </div>
          <p className="text-gray-700 mb-6 text-lg">
            Meanwhile, you can browse for more camps here
          </p>
          <Link to="/camps">
            <Button size="lg" className="text-lg px-8 py-3 flex items-center gap-2 mx-auto">
              Explore Camps
              <span className="text-xl">→</span>
            </Button>
          </Link>
        </div>

        {/* Additional Help */}
        <div className="text-sm text-gray-500">
          <p>Looking for a specific camp? Try searching by camp name or location.</p>
        </div>
      </div>
    </div>
  );
};

export default CampNotFound;

