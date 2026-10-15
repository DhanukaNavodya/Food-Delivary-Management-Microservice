# AWS Deployment (ECR + ECS Fargate + GitHub Actions)

On every push to `main`, GitHub Actions builds the six Docker images, pushes them to **Amazon ECR**, and restarts the **Amazon ECS** service so it runs the new images.

All six containers run together in **one ECS task** behind an **Application Load Balancer**. Containers in the same Fargate task share `localhost`, which is why [`api-gateway/nginx.conf`](api-gateway/nginx.conf) sends traffic to `127.0.0.1:5001`–`5005`.

```text
Client ──► Application Load Balancer :80
                     │
      ┌──────────────▼─────────── ECS task (Fargate) ───────────────────┐
      │  api-gateway (Nginx) :80                                       │
      │     ├──► 127.0.0.1:5001  auth-service                          │
      │     ├──► 127.0.0.1:5002  restaurant-service                    │
      │     ├──► 127.0.0.1:5003  order-service                         │
      │     ├──► 127.0.0.1:5004  delivery-service                      │
      │     └──► 127.0.0.1:5005  customer-service                      │
      └────────────────────────────────┬───────────────────────────────┘
                                       ▼
                         MongoDB Atlas (one database per service)
```

## 1) Prerequisites

- An AWS account. Pick one region and use it for every step, e.g. `ap-south-1` (Mumbai).
- A GitHub repository containing this project.
- A MongoDB Atlas cluster. Under **Network Access**, allow `0.0.0.0/0`, because the ECS task's IP address changes on every deployment.

Make sure the `.env` files are **not** committed. `.gitignore` already excludes them; check `git status` before you push.

## 2) Create the ECR repositories

AWS Console → **Elastic Container Registry → Create repository** (Private). Create these six:

| Repository name |
|---|
| `food-delivery/api-gateway` |
| `food-delivery/auth-service` |
| `food-delivery/restaurant-service` |
| `food-delivery/order-service` |
| `food-delivery/delivery-service` |
| `food-delivery/customer-service` |

## 3) Create an IAM user for GitHub Actions

AWS Console → **IAM → Users → Create user**

1. User name: `github-actions-deployer`.
2. Permissions → **Attach policies directly**:
   - `AmazonEC2ContainerRegistryPowerUser` (push images to ECR)
   - `AmazonECS_FullAccess` (update the ECS service)
3. Create the user, then open it → **Security credentials → Create access key** → *Application running outside AWS*.
4. Copy the **Access key ID** and **Secret access key**. The secret is only shown once.

## 4) Add GitHub secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key ID from step 3 |
| `AWS_SECRET_ACCESS_KEY` | Secret access key from step 3 |
| `AWS_REGION` | Your region, e.g. `ap-south-1` |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID (top-right menu in the console) |
| `ECS_CLUSTER` | `food-delivery-cluster` |
| `ECS_SERVICE` | `food-delivery-service` |

## 5) Push the first images

Push to `main`, or open **Actions → Deploy to AWS ECS → Re-run**. The build and push steps put all six images into ECR with the `latest` tag.

On this first run the **Force ECS deployment** step fails, because the cluster and service don't exist yet. That's expected. Check that each ECR repository now contains a `latest` image.

## 6) Create the CloudWatch log group

AWS Console → **CloudWatch → Log groups → Create log group** → name: `/ecs/food-delivery`.

## 7) Create the task definition

AWS Console → **Elastic Container Service → Task definitions → Create new task definition → Create new task definition with JSON**.

Paste the JSON below, then replace the placeholders:

| Placeholder | Replace with |
|---|---|
| `<AWS_ACCOUNT_ID>` | Your 12-digit account ID |
| `<AWS_REGION>` | Your region, e.g. `ap-south-1` |
| `<MONGO_BASE_URI>` | Your Atlas URI without a database name, e.g. `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net` |
| `<JWT_SECRET>` | A long random string, the same in every container |
| `<ADMIN_PASSWORD>` | Password for `admin@fooddelivery.local` |

```json
{
  "family": "food-delivery-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": [
    "FARGATE"
  ],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::<AWS_ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/api-gateway:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "api-gateway"
        }
      }
    },
    {
      "name": "auth-service",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/auth-service:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 5001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5001"
        },
        {
          "name": "SERVICE_NAME",
          "value": "Auth Service"
        },
        {
          "name": "MONGO_URI",
          "value": "<MONGO_BASE_URI>/auth_db?retryWrites=true&w=majority"
        },
        {
          "name": "JWT_SECRET",
          "value": "<JWT_SECRET>"
        },
        {
          "name": "JWT_EXPIRES_IN",
          "value": "1d"
        },
        {
          "name": "ADMIN_EMAIL",
          "value": "admin@fooddelivery.local"
        },
        {
          "name": "ADMIN_PASSWORD",
          "value": "<ADMIN_PASSWORD>"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "auth-service"
        }
      }
    },
    {
      "name": "restaurant-service",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/restaurant-service:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 5002,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5002"
        },
        {
          "name": "SERVICE_NAME",
          "value": "Restaurant Service"
        },
        {
          "name": "MONGO_URI",
          "value": "<MONGO_BASE_URI>/restaurant_db?retryWrites=true&w=majority"
        },
        {
          "name": "JWT_SECRET",
          "value": "<JWT_SECRET>"
        },
        {
          "name": "SEED_DATA",
          "value": "true"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "restaurant-service"
        }
      }
    },
    {
      "name": "order-service",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/order-service:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 5003,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5003"
        },
        {
          "name": "SERVICE_NAME",
          "value": "Order Service"
        },
        {
          "name": "MONGO_URI",
          "value": "<MONGO_BASE_URI>/order_db?retryWrites=true&w=majority"
        },
        {
          "name": "JWT_SECRET",
          "value": "<JWT_SECRET>"
        },
        {
          "name": "RESTAURANT_SERVICE_URL",
          "value": "http://127.0.0.1:5002"
        },
        {
          "name": "CUSTOMER_SERVICE_URL",
          "value": "http://127.0.0.1:5005"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "order-service"
        }
      }
    },
    {
      "name": "delivery-service",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/delivery-service:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 5004,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5004"
        },
        {
          "name": "SERVICE_NAME",
          "value": "Delivery Service"
        },
        {
          "name": "MONGO_URI",
          "value": "<MONGO_BASE_URI>/delivery_db?retryWrites=true&w=majority"
        },
        {
          "name": "JWT_SECRET",
          "value": "<JWT_SECRET>"
        },
        {
          "name": "ORDER_SERVICE_URL",
          "value": "http://127.0.0.1:5003"
        },
        {
          "name": "RESTAURANT_SERVICE_URL",
          "value": "http://127.0.0.1:5002"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "delivery-service"
        }
      }
    },
    {
      "name": "customer-service",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/food-delivery/customer-service:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 5005,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5005"
        },
        {
          "name": "SERVICE_NAME",
          "value": "Customer Service"
        },
        {
          "name": "MONGO_URI",
          "value": "<MONGO_BASE_URI>/customer_db?retryWrites=true&w=majority"
        },
        {
          "name": "JWT_SECRET",
          "value": "<JWT_SECRET>"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/food-delivery",
          "awslogs-region": "<AWS_REGION>",
          "awslogs-stream-prefix": "customer-service"
        }
      }
    }
  ]
}
```

Click **Create**.

> If the console says the role `ecsTaskExecutionRole` doesn't exist, create it: **IAM → Roles → Create role** → trusted entity *AWS service* → use case **Elastic Container Service Task** → attach `AmazonECSTaskExecutionRolePolicy` → name it `ecsTaskExecutionRole`. Then create the task definition again.

Keep these values in AWS only. Don't paste the filled-in JSON into any file in the repository.

## 8) Create the cluster

**ECS → Clusters → Create cluster**

- Cluster name: `food-delivery-cluster`
- Infrastructure: **AWS Fargate (serverless)**
- Create.

## 9) Create the service with a load balancer

First create a security group: **EC2 → Security Groups → Create security group**

- Name: `food-delivery-sg`, VPC: the default VPC
- Inbound rule: **HTTP, port 80, source `0.0.0.0/0`**
- Create.

Then **ECS → Clusters → food-delivery-cluster → Services → Create**:

1. **Environment:** Compute options → *Launch type* → **FARGATE**, platform version *LATEST*.
2. **Deployment configuration:**
   - Application type: *Service*
   - Task definition family: `food-delivery-task`, revision: latest
   - Service name: `food-delivery-service`
   - Desired tasks: `1`
3. **Networking:**
   - VPC: default VPC, all its subnets
   - Security group: **Use an existing security group** → `food-delivery-sg` (remove `default`)
   - Public IP: **Turned on** (the task needs it to pull images from ECR and reach MongoDB Atlas)
4. **Load balancing:**
   - Load balancer type: **Application Load Balancer** → *Create a new load balancer*, name `food-delivery-alb`
   - Container to load balance: **api-gateway 80:80**
   - Listener: *Create new listener*, port **80**, protocol **HTTP**
   - Target group: *Create new target group*, name `food-delivery-tg`, protocol **HTTP**
   - Health check path: **`/health`**
5. **Create.**

Wait until the service shows **1/1 tasks running** (about 3–5 minutes).

## 10) Verify

Find the load balancer's DNS name under **EC2 → Load Balancers → food-delivery-alb → DNS name**, e.g. `food-delivery-alb-123456789.ap-south-1.elb.amazonaws.com`.

- API Gateway: `http://<ALB_DNS>/`
- Gateway health: `http://<ALB_DNS>/health`
- Service health: `http://<ALB_DNS>/api/health/auth` (also `restaurant`, `order`, `delivery`, `customer`)
- Database check: `http://<ALB_DNS>/api/db-check/auth` (same names). It should show `"dbConnected": true`.
- Restaurants: `http://<ALB_DNS>/api/restaurants`
- Swagger docs: `http://<ALB_DNS>/api/docs/auth/` (also `restaurants`, `orders`, `deliveries`, `customers`)

Log in as the admin with Postman: `POST http://<ALB_DNS>/api/auth/login` with body `{"email":"admin@fooddelivery.local","password":"<ADMIN_PASSWORD>"}`.

## 11) Continuous deployment

From now on, every push to `main`:

1. builds the six images and pushes them to ECR as `latest`,
2. runs `aws ecs update-service --force-new-deployment`, which starts a new task with the new images and then stops the old one.

Watch it in GitHub **Actions**, then in **ECS → food-delivery-service → Deployments**.

## 12) Frontend

Point the frontend at the load balancer. In `food-delivery-frontend/.env`:

```env
API_GATEWAY_URL=http://<ALB_DNS>
```

## Troubleshooting

- **Task keeps stopping:** ECS → cluster → **Tasks** → *Stopped* → open the task and read *Stopped reason* and each container's *Exit code*. Container logs are in **CloudWatch → Log groups → /ecs/food-delivery**, one stream per container.
- **`CannotPullContainerError`:** the image isn't in ECR yet, or the account ID or region in the task definition is wrong. Re-run the workflow (step 5).
- **`/api/db-check/...` shows `dbConnected: false`:** check the Atlas Network Access list (`0.0.0.0/0`) and the `MONGO_URI` values in the task definition.
- **ALB returns 502/503:** the task isn't healthy yet, or the target group health check path isn't `/health`. Check **EC2 → Target groups → food-delivery-tg → Targets**.
- **Force ECS deployment step fails:** check the `ECS_CLUSTER` and `ECS_SERVICE` secrets match the names in steps 8 and 9.
- **Changing an environment variable:** ECS → Task definitions → `food-delivery-task` → **Create new revision**, edit the container's variables, then update the service to use the new revision.

## Stop costs

The task (1 vCPU, 2 GB) and the load balancer are billed while they exist. When you're finished:

1. ECS → `food-delivery-service` → **Delete service** (force delete).
2. EC2 → **Load Balancers** → delete `food-delivery-alb`, and **Target Groups** → delete `food-delivery-tg`.
3. ECS → delete `food-delivery-cluster`.
4. Optionally delete the ECR repositories and the `github-actions-deployer` access key.
