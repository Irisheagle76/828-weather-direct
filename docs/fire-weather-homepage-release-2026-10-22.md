# Homepage fire-weather release — October 22, 2026

Release the restored homepage fire-weather card with its 24-hour drought/fire graph, current-versus-peak labeling, automatic spring/fall profiles and explicit data dates. This is an intentional feature release, not a scheduled data-only deployment.

The fire implementation from f2ae72c6 is unchanged. Incorporate current main d272973a4dd409bcbbbae809517269d3fc6cf620 and its scheduled FEELSCORE data before rebuilding and verifying production. Retain rain fix b0da55e7 and sky-analysis fix f222a23d. Keep the fog experiment out of the homepage and automatic domain assignment disabled.

Run the complete test suite and verify the exact staged build before promotion. Seasonal coefficients remain provisional local guidance.
