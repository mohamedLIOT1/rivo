#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface RivoArtworkLoader : NSObject

+ (void)loadImageWithSource:(nullable NSString *)source
                 completion:(void (^)(UIImage * _Nullable image))completion;

+ (nullable UIImage *)cachedImageForSource:(nullable NSString *)source;

@end

NS_ASSUME_NONNULL_END
