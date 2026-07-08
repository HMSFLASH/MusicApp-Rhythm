import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
      <h1 className="text-8xl font-bold text-gray-800 dark:text-gray-100 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-600 dark:text-gray-300 mb-6">Page Not Found</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
        Oops! It seems like you've wandered into the wrong track. The page you are looking for does not exist or has been moved.
      </p>
      <Link 
        to="/" 
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors shadow-lg hover:shadow-xl"
      >
        Return to Home
      </Link>
    </div>
  );
}
