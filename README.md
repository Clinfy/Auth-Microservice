<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## Observability and Metrics

This microservice includes comprehensive observability features with Prometheus metrics and Grafana dashboards.

### Enabling Metrics

Set the following environment variables in your `.env` file:

```bash
# Enable/disable metrics endpoint (default: true)
METRICS_ENABLED=true

# Optional: API key for /metrics endpoint protection
# If not set, the endpoint is accessible without authentication (for local dev)
METRICS_API_KEY=your-secure-api-key
```

### Accessing the Metrics Endpoint

The metrics are exposed at `GET /metrics` in Prometheus text format.

**Without API key protection (local development):**
```bash
curl http://localhost:3000/metrics
```

**With API key protection:**
```bash
# Using Bearer token
curl -H "Authorization: Bearer your-api-key" http://localhost:3000/metrics

# Using X-Metrics-Key header
curl -H "X-Metrics-Key: your-api-key" http://localhost:3000/metrics

# Using query parameter
curl "http://localhost:3000/metrics?api_key=your-api-key"
```

### Running Prometheus and Grafana

Start the monitoring stack with Docker Compose:

```bash
# Start Prometheus and Grafana
cd ops/monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Stop the monitoring stack
docker-compose -f docker-compose.monitoring.yml down
```

**Access points:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (default credentials: admin/admin)

### Available Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `auth_http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests |
| `auth_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | HTTP request latency |
| `auth_redis_operation_duration_seconds` | Histogram | `operation`, `result` | Redis operation latency |
| `auth_redis_errors_total` | Counter | `operation`, `error_type` | Redis error count |
| `auth_jwt_operation_duration_seconds` | Histogram | `operation`, `result` | JWT operation latency |
| `auth_jwt_errors_total` | Counter | `operation`, `error_type` | JWT error count |
| `auth_rmq_operation_duration_seconds` | Histogram | `operation`, `result` | RabbitMQ operation latency |
| `auth_rmq_errors_total` | Counter | `operation`, `error_type` | RabbitMQ error count |
| `auth_rmq_outbox_backlog` | Gauge | `destination` | Pending outbox events |
| `auth_login_attempts_total` | Counter | `result` | Login attempt count |

### Dashboards

Pre-configured Grafana dashboards are available at `ops/monitoring/grafana/dashboards/`:

- **Auth Service Dashboard**: RPS, latency percentiles, error rates, login metrics, dependency health

### Alerting Rules

Prometheus alerting rules are defined in `ops/monitoring/prometheus/rules/alerts.yml`:

- `AuthServiceDown`: Service unreachable for 1+ minute
- `HighErrorRate5xx`: >5% 5xx errors for 5+ minutes
- `HighErrorRate4xx`: >20% 4xx errors for 5+ minutes
- `HighLatencyP95`: P95 latency >1s for 5+ minutes
- `HighLatencyP99`: P99 latency >2s for 5+ minutes
- `DatabaseErrorsHigh`: High DB error rate
- `RedisErrorsHigh`: High Redis error rate
- `RabbitMQErrorsHigh`: High RabbitMQ error rate
- `HighLoginFailureRate`: >50% login failures
- `OutboxBacklogHigh`: >100 pending outbox events

### Troubleshooting

**No data in Prometheus/Grafana:**
1. Verify the auth service is running: `curl http://localhost:3000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Ensure `host.docker.internal` resolves (Docker Desktop) or update `prometheus.yml` with correct target

**Empty labels or high cardinality:**
- Route normalization automatically converts `/users/123` to `/users/:id`
- Check for custom routes not following standard patterns

**Scrape timeout:**
- Increase `scrape_timeout` in `prometheus.yml` if the service is slow to respond

### Acceptance Checklist

- [ ] `/metrics` endpoint returns valid Prometheus format
- [ ] Prometheus successfully scrapes the service (check targets page)
- [ ] Grafana dashboards display live data
- [ ] Alerts trigger under simulated failure conditions

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
