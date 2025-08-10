"""
Configuration settings for the marketing app backend.
Loads environment variables for sensitive data and app config for application settings.
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

class Settings:
    """Application settings loaded from environment variables and config files"""
    
    def __init__(self):
        # Load application config
        self._load_app_config()
    
    def _load_app_config(self):
        """Load application configuration from JSON file"""
        config_path = Path(__file__).parent / 'app_config.json'
        try:
            with open(config_path, 'r') as f:
                self._app_config = json.load(f)
        except FileNotFoundError:
            raise ValueError(f"Application config file not found: {config_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in config file: {e}")
    
    # Environment Variables (sensitive/environment-specific)
    @property
    def OPENAI_API_KEY(self) -> str:
        return os.getenv('OPENAI_API_KEY', '')
    
    @property
    def ENVIRONMENT(self) -> str:
        return os.getenv('ENVIRONMENT', 'development')
    
    @property
    def HOST(self) -> str:
        return os.getenv('HOST', 'localhost')
    
    @property
    def PORT(self) -> int:
        return int(os.getenv('PORT', '8000'))
    
    @property
    def DEBUG(self) -> bool:
        return os.getenv('DEBUG', 'false').lower() == 'true'
    
    @property
    def LOG_LEVEL(self) -> str:
        return os.getenv('LOG_LEVEL', 'INFO')
    
    @property
    def TEMP_DIR(self) -> str:
        return os.getenv('TEMP_DIR', '/tmp/marketing_app')
    
    @property
    def OUTPUT_DIR(self) -> str:
        return os.getenv('OUTPUT_DIR', './outputs')
    
    # Application Configuration (from JSON)
    @property
    def MAX_VIDEO_DURATION(self) -> float:
        return self._app_config['video_processing']['max_video_duration']
    
    @property
    def MAX_VIDEO_SIZE_MB(self) -> float:
        return self._app_config['video_processing']['max_video_size_mb']
    
    @property
    def TARGET_FRAMES_PER_VIDEO(self) -> int:
        return self._app_config['video_processing']['target_frames_per_video']
    
    @property
    def JUMP_CUT_THRESHOLD(self) -> float:
        return self._app_config['video_processing']['jump_cut_threshold']
    
    @property
    def MAX_FRAMES_PER_VIDEO(self) -> int:
        return self._app_config['video_processing']['max_frames_per_video']
    
    @property
    def API_TIMEOUT(self) -> int:
        return self._app_config['api']['timeout']
    
    @property
    def MAX_CONCURRENT_REQUESTS(self) -> int:
        return self._app_config['api']['max_concurrent_requests']
    
    @property
    def OPENAI_MODEL(self) -> str:
        return self._app_config['api']['openai_model']
    
    @property
    def MAX_TOKENS(self) -> int:
        return self._app_config['api']['max_tokens']
    
    @property
    def MAX_FRAMES_PER_BATCH(self) -> int:
        return self._app_config['api']['max_frames_per_batch']
    
    @property
    def FRAME_IMAGE_MAX_SIZE(self) -> int:
        return self._app_config['api']['frame_image_max_size']
    
    @property
    def FRAME_IMAGE_QUALITY(self) -> int:
        return self._app_config['api']['frame_image_quality']
    
    @property
    def LOG_FORMAT(self) -> str:
        return self._app_config['logging']['format']
    
    # Paths
    @property
    def PROJECT_ROOT(self) -> Path:
        return Path(__file__).parent.parent
    
    @property
    def CONFIG_DIR(self) -> Path:
        return self.PROJECT_ROOT / 'config'
    
    @property
    def PROMPTS_FILE(self) -> Path:
        return self.CONFIG_DIR / 'prompts.json'
    
    def validate(self) -> list:
        """Validate required settings and return list of errors"""
        errors = []
        
        if not self.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required but not set")
        
        if self.MAX_VIDEO_DURATION <= 0:
            errors.append("MAX_VIDEO_DURATION must be positive")
            
        if self.TARGET_FRAMES_PER_VIDEO <= 0:
            errors.append("TARGET_FRAMES_PER_VIDEO must be positive")
            
        if not (0 < self.JUMP_CUT_THRESHOLD < 1):
            errors.append("JUMP_CUT_THRESHOLD must be between 0 and 1")
        
        return errors
    
    def ensure_directories(self):
        """Create necessary directories if they don't exist"""
        Path(self.TEMP_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

# Create settings instance
settings = Settings()

# Validate settings on import
validation_errors = settings.validate()
if validation_errors:
    error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in validation_errors)
    raise ValueError(error_msg)