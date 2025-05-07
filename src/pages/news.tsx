export function NewsPage() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="container mx-auto max-w-6xl px-4">
        <h1 className="text-3xl font-bold mb-4">Latest News</h1>
        <p className="text-default-600 mb-8">
          Stay updated with the latest news and events at Ridgefield Golf Club.
        </p>
        {/* Placeholder for news articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Example news article card */}
          <div className="bg-content1 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Upcoming Tournament</h2>
            <p className="text-default-500 mb-4">
              Join us for the annual Ridgefield Open on June 15th. Register now!
            </p>
            <a href="#" className="text-primary hover:underline">
              Read more
            </a>
          </div>
          {/* Add more news articles as needed */}
        </div>
      </div>
    </section>
  );
}
