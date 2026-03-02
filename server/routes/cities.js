const express = require('express');
const axios = require('axios');

const router = express.Router();

// @route   GET /api/cities
// @desc    Search global cities
// @access  Public
router.get('/', async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (query.length < 2) {
      return res.json({ cities: [] });
    }

    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: {
        name: query,
        count: 10,
        language: 'en',
        format: 'json'
      },
      timeout: 8000
    });

    const rawResults = Array.isArray(response.data?.results) ? response.data.results : [];
    const cities = rawResults.slice(0, 10).map((item) => ({
      city: item.name || '',
      state: item.admin1 || '',
      country: item.country || '',
      countryCode: item.country_code || '',
      lat: Number(item.latitude),
      lng: Number(item.longitude),
      placeId: item.id ? String(item.id) : undefined
    })).filter((item) =>
      item.city &&
      item.country &&
      item.countryCode &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng)
    );

    res.json({ cities });
  } catch (error) {
    console.error('City search error:', error.message);
    res.status(500).json({ message: 'Failed to search cities', cities: [] });
  }
});

module.exports = router;
