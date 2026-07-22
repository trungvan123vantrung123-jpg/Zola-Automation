// Danh sách các bộ từ đồng nghĩa hay dùng để spin nội dung.
// Mỗi bộ khi click sẽ chèn nguyên văn `text` vào vị trí con trỏ trong ô soạn nội dung.
export const WORD_SPIN_PRESETS = [
  { id: 1, text: "{Sale|Giảm Giá|Khuyến Mãi|Khuyến Mại}" },
  { id: 2, text: "{Khuyến mãi|Ưu đãi|KHUYẾN MÃI|Chỉ còn}" },
  { id: 3, text: "{Chương trình|Sự Kiện|Chương trình}" },
  { id: 4, text: "{Shop|Cửa hàng|shop}" },
  { id: 5, text: "{voucher|phiếu giảm giá|phiếu quà tặng|Voucher|thẻ giảm giá}" },
  { id: 6, text: "{tri ân|gửi lời cảm ơn|cảm ơn}" },
  { id: 7, text: "{Kính chúc|Chúc|Cảm ơn}" },
  { id: 8, text: "{khách hàng|quý khách|Anh/chị|quý KH|KH}" },
  { id: 9, text: "{xả kho|xả lỗ|xả hàng|thanh lý|đại hạ giá}" },
  { id: 10, text: "{Combo|Bộ sản phẩm|Gói Combo}" },
  { id: 11, text: "{Áp dụng|Chỉ áp dụng|Ưu đãi áp dụng}" },
  { id: 12, text: "{Số điện thoại|SĐT|SỐ ĐIỆN THOẠI|sdt|Sdt}" },
  { id: 13, text: "{Địa chỉ|ĐỊA CHỈ|Địa chỉ giao hàng}" },
  {
    id: 14,
    text: "{Freeship|Miễn phí ship|Miễn phí giao hàng|Miễn phí giao hàng toàn quốc|Ship 0đ|Ship không mất phí}",
  },
  { id: 15, text: "{Cảm ơn|Chân thành cảm ơn|Lời cảm ơn}" },
  { id: 16, text: "{Chỉ hôm nay|hôm nay|duy nhất hôm nay}" },
  { id: 17, text: "{Live|Livestream|LIVESTREAM}" },
  { id: 18, text: "{Đầu tháng|Tháng mới|Mùng 1}" },
  { id: 19, text: "{Mong|Rất Mong|Kính mong}" },
  { id: 20, text: "{Fanpage|Page|Trang}" },
];

// Danh sách các bộ icon ngẫu nhiên. Mỗi bộ khi click sẽ chèn nguyên văn `text`
// (đã có sẵn cấu trúc lặp {..}{..} theo đúng mẫu gốc) vào vị trí con trỏ.
export const ICON_SPIN_PRESETS = [
  {
    id: "R0",
    label: "Cây cỏ thiên nhiên",
    text: "{🍄|🎄|🌳|🌳|🌴|🌵|🎍|🌿|🌱|🍁|🍂|🍃|🍀|☘|🎋}{🍄|🎄|🌳|🌳|🌴|🌵|🎍|🌿|🌱|🍁|🍂|🍃|🍀|☘|🎋}",
  },
  {
    id: "R1",
    label: "Trái cây",
    text: "{🍏|🍎|🍊|🍐|🍋|🍌|🍉|🍇|🍓|🍈|🥝|🥑|🍍|🍒|🍑|🍆|🥕|🌶|🌽|🍅}{🍏|🍎|🍊|🍐|🍋|🍌|🍉|🍇|🍓|🍈|🥝|🥑|🍍|🍒|🍑|🍆|🥕|🌶|🌽|🍅}",
  },
  {
    id: "R2",
    label: "Lấp lánh / bầu trời",
    text: "{💫|⭐|🌟|✨|⚡|💥|☄️|🌞|☀️|🌤️|⛅|🌥️|🌈|🌙|🌛}{💫|⭐|🌟|✨|⚡|💥|☄️|🌞|☀️|🌤️|⛅|🌥️|🌈|🌙|🌛}",
  },
  {
    id: "R3",
    label: "Cao cấp / nổi bật",
    text: "{👑|✅|💍|💧|💦|⚡️|✨|🌟|⭐️|🔥|💥|🏆|🥇|🎁|✅|⚜️|🔱|🆗|✔️|☑️}",
  },
  {
    id: "R4",
    label: "Trái tim",
    text: "{♥️|❤️|💛|💚|💙|💜|💖|❣️|💕|💞|💓|💗|💘|💟}{♥️|❤️|💛|💚|💙|💜|💖|❣️|💕|💞|💓|💗|💘|💟}",
  },
];

// Text chèn khi bấm nút "Thêm tên khách hàng"
export const CUSTOMER_NAME_TAG = "{@khachhang}";
