NAME = libftprintf.a

CC = cc
CFLAGS = -Wall -Wextra -Werror

SRC_DIR = src/
OBJ_DIR = obj/

SRCS =	ft_printf.c \
		ft_flags_utils.c \
		ft_flags.c \
		ft_nbr_len.c \
		ft_print_char.c \
		ft_print_flag.c \
		ft_print_hex.c \
		ft_print_int.c \
		ft_print_ptr.c \
		ft_print_str.c \
		ft_print_unsigned.c \
		ft_printf_itoa.c \
		ft_printf_utoa.c \
		ft_printf_xtoa.c

OBJS = $(addprefix $(OBJ_DIR), $(SRCS:.c=.o))

LIBFT_DIR = libft/
LIBFT = $(LIBFT_DIR)libft.a

all: $(LIBFT) $(NAME)

$(LIBFT):
	@$(MAKE) -C $(LIBFT_DIR)

$(NAME): $(OBJS) $(LIBFT)
	@cp $(LIBFT) $(NAME)
	@ar rcs $(NAME) $(OBJS)
	@echo "\033[1;32m✅ ft_printf compiled successfully!\033[0m"

bonus: all

$(OBJ_DIR)%.o: $(SRC_DIR)%.c
	@mkdir -p $(dir $@)
	@$(CC) $(CFLAGS) -I$(SRC_DIR) -I$(LIBFT_DIR)src/ -c $< -o $@

clean:
	@rm -rf $(OBJ_DIR)
	@$(MAKE) -C $(LIBFT_DIR) clean

fclean: clean
	@rm -f $(NAME)
	@$(MAKE) -C $(LIBFT_DIR) fclean

re: fclean all

rebonus: fclean bonus

.PHONY: all clean fclean re bonus rebonus
