#!/bin/bash

# ShotSpot Deployment Script
# This script deploys ShotSpot using Docker

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="ghcr.io/psecurit/shotspot"
DEFAULT_VERSION="latest"
COMPOSE_FILE="docker-compose.yml"

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    print_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_info "Requirements satisfied ✓"
}

check_env_file() {
    if [ ! -f .env ]; then
        print_warn ".env file not found. Creating from template..."
        
        if [ -f ../.env.docker.example ]; then
            cp ../.env.docker.example .env
            print_warn "Please edit .env file with your configuration before deploying!"
            print_warn "Minimum required: DB_PASSWORD and JWT_SECRET"
            exit 1
        else
            print_error ".env.docker.example not found. Cannot create .env file."
            exit 1
        fi
    fi
    
    # Check for required secrets
    if grep -q "CHANGE_THIS" .env; then
        print_error ".env file contains default values. Please update DB_PASSWORD and JWT_SECRET!"
        exit 1
    fi
    
    print_info "Environment configuration validated ✓"
}

pull_image() {
    local VERSION=${1:-$DEFAULT_VERSION}
    print_info "Pulling image ${IMAGE_NAME}:${VERSION}..."
    
    docker pull "${IMAGE_NAME}:${VERSION}"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to pull image. Please check your internet connection and image name."
        exit 1
    fi
    
    print_info "Image pulled successfully ✓"
}

deploy() {
    print_info "Starting deployment..."
    
    # Stop existing containers
    if docker-compose ps | grep -q "Up"; then
        print_info "Stopping existing containers..."
        docker-compose down
    fi
    
    # Start new containers
    print_info "Starting containers..."
    docker-compose up -d
    
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Check logs with: docker-compose logs"
        exit 1
    fi
    
    print_info "Deployment successful ✓"
}

wait_for_health() {
    print_info "Waiting for application to become healthy..."
    
    local MAX_ATTEMPTS=30
    local ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if docker-compose ps | grep -q "healthy"; then
            print_info "Application is healthy ✓"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_error "Application did not become healthy in time. Check logs with: docker-compose logs app"
    return 1
}

show_status() {
    print_info "Application Status:"
    docker-compose ps
    
    echo ""
    print_info "Application URL: http://localhost:3001"
    print_info "API Health: http://localhost:3001/api/health"
    
    echo ""
    print_info "To view logs: docker-compose logs -f"
    print_info "To stop: docker-compose down"
}

backup_database() {
    print_info "Creating database backup..."
    
    local BACKUP_DIR="./backups"
    local BACKUP_FILE="${BACKUP_DIR}/shotspot_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    docker-compose exec -T db pg_dump -U shotspot_user shotspot_db > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_info "Backup saved to: $BACKUP_FILE ✓"
    else
        print_error "Backup failed"
        exit 1
    fi
}

# Main script
main() {
    echo "=========================================="
    echo "  ShotSpot Docker Deployment Script"
    echo "=========================================="
    echo ""
    
    # Parse arguments
    local COMMAND=${1:-deploy}
    local VERSION=${2:-$DEFAULT_VERSION}
    
    case $COMMAND in
        deploy)
            check_requirements
            check_env_file
            pull_image "$VERSION"
            deploy
            wait_for_health
            show_status
            ;;
        pull)
            check_requirements
            pull_image "$VERSION"
            ;;
        start)
            check_requirements
            check_env_file
            deploy
            wait_for_health
            show_status
            ;;
        stop)
            print_info "Stopping containers..."
            docker-compose down
            print_info "Stopped ✓"
            ;;
        restart)
            print_info "Restarting containers..."
            docker-compose restart
            wait_for_health
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            docker-compose logs -f
            ;;
        backup)
            check_requirements
            backup_database
            ;;
        update)
            check_requirements
            check_env_file
            backup_database
            pull_image "$VERSION"
            deploy
            wait_for_health
            show_status
            ;;
        *)
            echo "Usage: $0 {deploy|pull|start|stop|restart|status|logs|backup|update} [version]"
            echo ""
            echo "Commands:"
            echo "  deploy   - Pull image, deploy, and wait for health (default)"
            echo "  pull     - Pull latest image"
            echo "  start    - Start containers (without pulling)"
            echo "  stop     - Stop containers"
            echo "  restart  - Restart containers"
            echo "  status   - Show application status"
            echo "  logs     - Follow container logs"
            echo "  backup   - Backup database"
            echo "  update   - Backup, pull, and deploy new version"
            echo ""
            echo "Examples:"
            echo "  $0 deploy          # Deploy latest version"
            echo "  $0 deploy v1.2.3   # Deploy specific version"
            echo "  $0 update          # Update to latest"
            echo "  $0 backup          # Backup database"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
