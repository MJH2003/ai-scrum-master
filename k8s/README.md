# Kubernetes Deployment Guide for AI Scrum Master

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Docker registry access
- cert-manager (for TLS)
- nginx-ingress controller

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets

```bash
# Create secrets from command line (recommended for production)
kubectl create secret generic api-secrets \
  --namespace ai-scrum-master \
  --from-literal=DATABASE_USER='postgres' \
  --from-literal=DATABASE_PASSWORD='your-secure-password' \
  --from-literal=JWT_SECRET="$(openssl rand -base64 64)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -base64 64)" \
  --from-literal=OPENAI_API_KEY='sk-...' \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-...' \
  --from-literal=GOOGLE_AI_API_KEY='...' \
  --from-literal=REDIS_PASSWORD='redis-password'

kubectl create secret generic postgres-secrets \
  --namespace ai-scrum-master \
  --from-literal=POSTGRES_USER='postgres' \
  --from-literal=POSTGRES_PASSWORD='your-secure-password' \
  --from-literal=POSTGRES_DB='ai_scrum_master'
```

### 3. Deploy ConfigMap

```bash
kubectl apply -f configmap.yaml
```

### 4. Run Database Migration

```bash
# Before first deployment or after schema changes
kubectl apply -f migration-job.yaml
kubectl wait --for=condition=complete job/db-migrate -n ai-scrum-master --timeout=120s
```

### 5. Deploy Application

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n ai-scrum-master

# Check services
kubectl get svc -n ai-scrum-master

# Check ingress
kubectl get ingress -n ai-scrum-master

# View logs
kubectl logs -l app=api -n ai-scrum-master --tail=100 -f
```

## External Database Setup

For production, use managed PostgreSQL and Redis services:

### Using AWS RDS / Azure Database / Cloud SQL

1. Update `configmap.yaml`:
```yaml
DATABASE_HOST: "your-rds-endpoint.region.rds.amazonaws.com"
```

2. Remove the in-cluster postgres service from `service.yaml`

### Using Redis Cloud / ElastiCache / Memorystore

1. Update `configmap.yaml`:
```yaml
REDIS_HOST: "your-redis-endpoint"
```

2. Remove the in-cluster redis service from `service.yaml`

## Scaling

### Manual Scaling

```bash
kubectl scale deployment api --replicas=5 -n ai-scrum-master
```

### HPA (Horizontal Pod Autoscaler)

Already configured in `hpa.yaml`. View status:

```bash
kubectl get hpa -n ai-scrum-master
```

## Rolling Updates

```bash
# Update image
kubectl set image deployment/api api=ai-scrum-master/backend:v1.2.0 -n ai-scrum-master

# Watch rollout
kubectl rollout status deployment/api -n ai-scrum-master

# Rollback if needed
kubectl rollout undo deployment/api -n ai-scrum-master
```

## Monitoring

### Port Forward for Local Access

```bash
kubectl port-forward svc/api-service 3000:80 -n ai-scrum-master
```

### Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## Troubleshooting

### Check Pod Status

```bash
kubectl describe pod <pod-name> -n ai-scrum-master
```

### Check Events

```bash
kubectl get events -n ai-scrum-master --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connectivity from within the cluster
kubectl run -it --rm debug --image=postgres:16-alpine -n ai-scrum-master -- \
  psql "postgresql://user:password@postgres-service:5432/ai_scrum_master"
```

## Cleanup

```bash
kubectl delete namespace ai-scrum-master
```

## File Structure

```
k8s/
├── namespace.yaml       # Namespace definition
├── configmap.yaml       # Non-sensitive configuration
├── secrets.template.yaml # Secrets template (DO NOT commit with real values)
├── deployment.yaml      # API deployment with service account
├── service.yaml         # ClusterIP services for API, Postgres, Redis
├── ingress.yaml         # Ingress with TLS and network policy
├── hpa.yaml             # Horizontal Pod Autoscaler + PDB
├── migration-job.yaml   # Database migration job
└── README.md            # This file
```
