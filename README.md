# Proofhold

A PayPal payment that is held until the agreed proof arrives.

Proofhold compiles a plain-language brief into an acceptance test, lets the buyer approve a PayPal authorization against that exact test, verifies the seller's evidence with deterministic checks and an AI examiner that is allowed to abstain, and then captures, partially captures, voids, or escalates into a PayPal dispute. PayPal holds the money the whole time. Proofhold never does.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## Status

Under active development. See [docs/product.md](docs/product.md) for the product model and [docs/architecture.md](docs/architecture.md) for how it is put together. The build log is in [docs/build-log.md](docs/build-log.md).

## License

MIT. See [LICENSE](LICENSE).
