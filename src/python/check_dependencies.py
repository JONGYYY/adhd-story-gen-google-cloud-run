import sys
import pkg_resources

required_packages = [
    'moviepy',
    'numpy',
]

def check_dependencies():
    missing = []
    for package in required_packages:
        try:
            pkg_resources.require(package)
        except pkg_resources.DistributionNotFound:
            missing.append(package)
    
    if missing:
        print(f"Missing packages: {', '.join(missing)}")
        sys.exit(1)
    else:
        print("All required packages are installed")
        print("\nInstalled versions:")
        for package in required_packages:
            version = pkg_resources.require(package)[0].version
            print(f"{package}: {version}")

if __name__ == "__main__":
    check_dependencies() 