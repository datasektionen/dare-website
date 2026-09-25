job "dare" {
  type = "service"

  group "dare" {
    network {
      port "http" { }
    }

    service {
      name     = "dare"
      port     = "http"
      provider = "nomad"
      tags = [
        "traefik.enable=true",
        # dåre.se in punycode
        "traefik.http.routers.dare.rule=Host(`xn--dre-ula.se`)",
        "traefik.http.routers.dare.tls.certresolver=default",
      ]
    }

    task "dare" {
      driver = "docker"

      config {
        image = var.image_tag
        ports = ["http"]
      }

      template {
        data        = <<ENV
{{ with nomadVar "nomad/jobs/dare" }}
DATABASE_URL=postgres://dare:{{ .db_password }}@postgres.dsekt.internal:5432/dare
SESSION_SECRET={{ .session_secret }}
OIDC_CLIENT_SECRET={{ .oidc_client_secret }}
{{ end }}
PORT={{ env "NOMAD_PORT_http" }}
NODE_ENV=production
APP_URL=https://xn--dre-ula.se
OIDC_ISSUER=https://sso.datasektionen.se/op
OIDC_CLIENT_ID=dare
SSO_API_URL=http://sso.nomad.dsekt.internal
ENV
        destination = "local/.env"
        env         = true
      }

      resources {
        memory = 256
      }
    }
  }
}

variable "image_tag" {
  type    = string
  default = "ghcr.io/datasektionen/dare-website:latest"
}
