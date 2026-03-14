module "foundation" {
  source = "../../modules/foundation"

  environment  = var.environment
  location     = var.location
  project_name = var.project_name
}
